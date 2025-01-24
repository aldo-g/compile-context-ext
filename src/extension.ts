/**
 * Main activation file for the Compile Context VSCode extension.
 */
import * as vscode from 'vscode';
import { FileTreeProvider } from './treeDataProvider';
import { FileNode } from './models/FileNode';
import { compileContext } from './compileContext';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Activates the Compile Context extension by setting up the Tree View and related commands.
 */
export function activate(context: vscode.ExtensionContext) {
    const workspaceRoot = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : '';
    const persistedSelections: string[] = context.globalState.get('checkedFiles', []);
    const checkedFiles = new Set<string>(persistedSelections);
    const treeDataProvider = new FileTreeProvider(workspaceRoot, checkedFiles);
    const treeView = vscode.window.createTreeView('compileContextView', { treeDataProvider });

    const expandedSet = new Set<string>();
    treeView.onDidExpandElement(e => expandedSet.add(e.element.uri.fsPath));
    treeView.onDidCollapseElement(e => expandedSet.delete(e.element.uri.fsPath));

    /**
     * Refreshes the entire Tree View.
     */
    const refreshTreeView = async () => {
        treeDataProvider.refresh();
    };

    /**
     * Toggles the selection state of a FileNode.
     */
    vscode.commands.registerCommand('compileContext.toggleCheckbox', async (element: FileNode) => {
        if (!workspaceRoot) return;
        if (isDirectory(element)) {
            const allChildFilePaths = await getAllChildFiles(element.uri.fsPath);
            const isChecked = allChildFilePaths.length > 0 && allChildFilePaths.every(fp => checkedFiles.has(fp));
            if (isChecked) {
                allChildFilePaths.forEach(fp => {
                    checkedFiles.delete(fp);
                    console.log(`Removed: ${fp}`);
                });
            } else {
                allChildFilePaths.forEach(fp => {
                    checkedFiles.add(fp);
                    console.log(`Added: ${fp}`);
                });
            }
        } else {
            if (element.checked) {
                checkedFiles.delete(element.uri.fsPath);
                console.log(`Removed: ${element.uri.fsPath}`);
            } else {
                checkedFiles.add(element.uri.fsPath);
                console.log(`Added: ${element.uri.fsPath}`);
            }
        }
        await refreshTreeView();
        context.globalState.update('checkedFiles', Array.from(checkedFiles));
    });

    /**
     * Compiles the selected context into the output file.
     */
    vscode.commands.registerCommand('compileContext.compileContext', async () => {
        if (!workspaceRoot) return;
        const selectedFiles = treeDataProvider.getAllCheckedFiles();
        if (!selectedFiles.length) {
            vscode.window.showWarningMessage('No files selected. Please select at least one file to compile context.');
            return;
        }

        const config = vscode.workspace.getConfiguration('compileContext');
        const outputFile: string = config.get('outputFile') || '.compile-context/file_context.txt';
        const excludeFiles: string[] = config.get('excludeFiles') || [];
        const excludePaths: string[] = config.get('excludePaths') || [];
        const excludeHidden: boolean = config.get('excludeHidden') ?? true;

        try {
            const subDir = path.dirname(outputFile);
            await fs.mkdir(path.join(workspaceRoot, subDir), { recursive: true });
        } catch (err) {
            console.error(`Failed to create subdirectory for output file: ${err}`);
        }

        const filtered = selectedFiles.filter(file => {
            const rel = path.relative(workspaceRoot, file.uri.fsPath).replace(/\\/g, '/');
            const base = path.basename(rel);
            if (excludeFiles.includes(base)) return false;
            if (excludePaths.some(ex => rel.startsWith(ex))) return false;
            if (excludeHidden && isHidden(rel)) return false;
            return true;
        });
        if (!filtered.length) {
            vscode.window.showWarningMessage('No files to include after applying exclusions.');
            return;
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Compiling Context...",
            cancellable: false
        }, async progress => {
            progress.report({ increment: 0 });
            try {
                await compileContext(workspaceRoot, outputFile, filtered, excludeFiles, excludePaths, excludeHidden);
                progress.report({ increment: 100 });
                vscode.window.showInformationMessage('Context compilation completed successfully!');
            } catch (error: unknown) {
                if (error instanceof Error) {
                    vscode.window.showErrorMessage(`Failed to compile context: ${error.message}`);
                } else {
                    vscode.window.showErrorMessage('Failed to compile context due to an unknown error.');
                }
                console.error(error);
            }
        });
    });

    /**
     * Selects all files in the workspace.
     */
    vscode.commands.registerCommand('compileContext.selectAll', async () => {
        if (!workspaceRoot) return;
        const allFilePaths = await getAllFiles(workspaceRoot);
        allFilePaths.forEach(fp => {
            if (!checkedFiles.has(fp)) {
                checkedFiles.add(fp);
                console.log(`Added: ${fp}`);
            }
        });
        await refreshTreeView();
        context.globalState.update('checkedFiles', Array.from(checkedFiles));
    });

    /**
     * Deselects all files in the workspace.
     */
    vscode.commands.registerCommand('compileContext.deselectAll', async () => {
        checkedFiles.forEach(fp => {
            console.log(`Removed: ${fp}`);
        });
        checkedFiles.clear();
        await refreshTreeView();
        context.globalState.update('checkedFiles', []);
    });

    /**
     * Command for the Compile Context button in the title bar.
     */
    vscode.commands.registerCommand('compileContext.compileContextButton', async () => {
        vscode.commands.executeCommand('compileContext.compileContext');
    });
}

/**
 * Checks if a FileNode is a directory based on collapsible state.
 */
function isDirectory(node: FileNode): boolean {
    return node.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed || node.collapsibleState === vscode.TreeItemCollapsibleState.Expanded;
}

/**
 * Recursively gathers file paths under a directory, asynchronously.
 */
async function getAllChildFiles(dirPath: string): Promise<string[]> {
    let results: string[] = [];
    try {
        const list = await fs.readdir(dirPath, { withFileTypes: true });
        for (const dirent of list) {
            const fp = path.join(dirPath, dirent.name);
            if (dirent.isDirectory()) {
                const sub = await getAllChildFiles(fp);
                results = results.concat(sub);
            } else if (dirent.isFile()) {
                results.push(fp);
            }
        }
    } catch (err) {
        vscode.window.showErrorMessage(`Error reading directory ${dirPath}: ${String(err)}`);
    }
    return results;
}

/**
 * Retrieves all file paths in the workspace.
 */
async function getAllFiles(dirPath: string): Promise<string[]> {
    return getAllChildFiles(dirPath);
}

/**
 * Checks if a file path is hidden by checking path parts starting with '.'.
 */
function isHidden(relPath: string): boolean {
    return relPath.split(path.sep).some(part => part.startsWith('.'));
}