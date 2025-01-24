// src/extension.ts
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
 * Activates the Compile Context extension, setting up the Tree View and registering commands.
 * @param context The extension context.
 */
export function activate(context: vscode.ExtensionContext) {
    const workspaceRoot = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : '';

    const persistedSelections: string[] = context.globalState.get('checkedFiles', []);
    const checkedFiles = new Set<string>(persistedSelections);

    const treeDataProvider = new FileTreeProvider(workspaceRoot, checkedFiles);
    const treeView = vscode.window.createTreeView('compileContextView', { treeDataProvider: treeDataProvider });

    const expandedSet = new Set<string>();

    treeView.onDidExpandElement(event => {
        expandedSet.add(event.element.uri.fsPath);
    });

    treeView.onDidCollapseElement(event => {
        expandedSet.delete(event.element.uri.fsPath);
    });

    /**
     * Refreshes the entire Tree View while maintaining the expansion state.
     */
    const refreshTreeView = async () => {
        treeDataProvider.refresh();
    };

    /**
     * Toggles the checkbox state of a FileNode.
     * @param element The FileNode to toggle.
     */
    vscode.commands.registerCommand('compileContext.toggleCheckbox', async (element: FileNode) => {
        const affectedPaths = new Set<string>();

        if (isDirectory(element)) {
            const allChildFilePaths = await getAllChildFiles(element.uri.fsPath);
            const isChecked = allChildFilePaths.length > 0 && allChildFilePaths.every(filePath => checkedFiles.has(filePath));

            if (isChecked) {
                allChildFilePaths.forEach(filePath => {
                    checkedFiles.delete(filePath);
                    console.log(`Removed: ${filePath}`);
                    affectedPaths.add(path.dirname(filePath));
                });
            } else {
                allChildFilePaths.forEach(filePath => {
                    checkedFiles.add(filePath);
                    console.log(`Added: ${filePath}`);
                    affectedPaths.add(path.dirname(filePath));
                });
            }

            affectedPaths.add(element.uri.fsPath);
        } else {
            if (element.checked) {
                checkedFiles.delete(element.uri.fsPath);
                console.log(`Removed: ${element.uri.fsPath}`);
                affectedPaths.add(path.dirname(element.uri.fsPath));
            } else {
                checkedFiles.add(element.uri.fsPath);
                console.log(`Added: ${element.uri.fsPath}`);
                affectedPaths.add(path.dirname(element.uri.fsPath));
            }

            affectedPaths.add(path.dirname(element.uri.fsPath));
        }

        // Instead of refreshing specific nodes, refresh the entire tree
        await refreshTreeView();

        const allCheckedFiles = Array.from(checkedFiles);
        context.globalState.update('checkedFiles', allCheckedFiles);
    });

    /**
     * Compiles the selected context into the output file.
     */
    vscode.commands.registerCommand('compileContext.compileContext', async () => {
        const selectedFiles = treeDataProvider.getAllCheckedFiles();

        if (selectedFiles.length === 0) {
            vscode.window.showWarningMessage('No files selected. Please select at least one file to compile context.');
            return;
        }

        const config = vscode.workspace.getConfiguration('compileContext');
        const outputFile: string = config.get('outputFile') || 'file_context.txt';
        const excludeFiles: string[] = config.get('excludeFiles') || [];
        const excludePaths: string[] = config.get('excludePaths') || [];
        const excludeHidden: boolean = config.get('excludeHidden') ?? true;

        const filteredFiles = selectedFiles.filter(file => {
            const fileName = path.basename(file.uri.fsPath);
            const relativePath = path.relative(workspaceRoot, file.uri.fsPath).replace(/\\/g, '/');

            if (excludeFiles.includes(fileName)) {
                return false;
            }

            if (excludePaths.some(excludePath => relativePath.startsWith(excludePath))) {
                return false;
            }

            if (excludeHidden && isHidden(relativePath)) {
                return false;
            }

            return true;
        });

        if (filteredFiles.length === 0) {
            vscode.window.showWarningMessage('No files to include after applying exclusions.');
            return;
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Compiling Context...",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });
            try {
                await compileContext(workspaceRoot, outputFile, filteredFiles, excludeFiles, excludePaths, excludeHidden);
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
        const allFilePaths = await getAllFiles(workspaceRoot);
        allFilePaths.forEach(filePath => {
            if (!checkedFiles.has(filePath)) {
                checkedFiles.add(filePath);
                console.log(`Added: ${filePath}`);
            }
        });
        await refreshTreeView();
        context.globalState.update('checkedFiles', Array.from(checkedFiles));
    });

    /**
     * Deselects all files in the workspace.
     */
    vscode.commands.registerCommand('compileContext.deselectAll', async () => {
        checkedFiles.forEach(filePath => {
            console.log(`Removed: ${filePath}`);
        });
        checkedFiles.clear();
        await refreshTreeView();
        context.globalState.update('checkedFiles', []);
    });

    /**
     * Adds a Compile Context button to the Tree View's title bar.
     */
    vscode.commands.registerCommand('compileContext.compileContextButton', async () => {
        vscode.commands.executeCommand('compileContext.compileContext');
    });
}

/**
 * Determines if a FileNode represents a directory.
 * @param node The FileNode to check.
 * @returns True if it's a directory, else false.
 */
function isDirectory(node: FileNode): boolean {
    return node.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed || node.collapsibleState === vscode.TreeItemCollapsibleState.Expanded;
}

/**
 * Recursively collects all file paths under a given directory asynchronously.
 * @param dirPath The directory path to traverse.
 * @returns A promise that resolves to an array of file paths.
 */
async function getAllChildFiles(dirPath: string): Promise<string[]> {
    let results: string[] = [];

    try {
        const list = await fs.readdir(dirPath, { withFileTypes: true });
        for (const dirent of list) {
            const filePath = path.join(dirPath, dirent.name);
            if (dirent.isDirectory()) {
                const subDirFiles = await getAllChildFiles(filePath);
                results = results.concat(subDirFiles);
            } else if (dirent.isFile()) {
                results.push(filePath);
            }
        }
    } catch (err) {
        vscode.window.showErrorMessage(`Error reading directory ${dirPath}:`, String(err));
    }

    return results;
}

/**
 * Retrieves all file paths within the workspace.
 * @param dirPath The root directory.
 * @returns A promise that resolves to an array of file paths.
 */
async function getAllFiles(dirPath: string): Promise<string[]> {
    return await getAllChildFiles(dirPath);
}

/**
 * Determines if a file or directory is hidden based on its relative path.
 * @param relativePath The path relative to the workspace root.
 * @returns True if hidden, else false.
 */
function isHidden(relativePath: string): boolean {
    return relativePath.split(path.sep).some(part => part.startsWith('.'));
}