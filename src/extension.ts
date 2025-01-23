/**
 * Main activation file for the Context Generator VSCode extension.
 */
import * as vscode from 'vscode';
import { FileTreeProvider } from './treeDataProvider';
import { FileNode } from './models/FileNode';
import { generateContext } from './generateContext';
import * as path from 'path';
import * as fs from 'fs/promises';

export function activate(context: vscode.ExtensionContext) {
    const workspaceRoot = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : '';

    const persistedSelections: string[] = context.globalState.get('checkedFiles', []);
    const checkedFiles = new Set<string>(persistedSelections);

    const treeDataProvider = new FileTreeProvider(workspaceRoot, checkedFiles);
    vscode.window.registerTreeDataProvider('contextGeneratorView', treeDataProvider);

    vscode.commands.registerCommand('contextGenerator.toggleCheckbox', async (element: FileNode) => {
        if (isDirectory(element)) {
            const allChildFilePaths = await getAllChildFiles(element.uri.fsPath);
            const isChecked = allChildFilePaths.length > 0 && allChildFilePaths.every(filePath => checkedFiles.has(filePath));

            if (isChecked) {
                allChildFilePaths.forEach(filePath => {
                    checkedFiles.delete(filePath);
                    console.log(`Removed: ${filePath}`);
                });
            } else {
                allChildFilePaths.forEach(filePath => {
                    checkedFiles.add(filePath);
                    console.log(`Added: ${filePath}`);
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

        treeDataProvider.refresh();

        const allCheckedFiles = Array.from(checkedFiles);
        context.globalState.update('checkedFiles', allCheckedFiles);
    });

    vscode.commands.registerCommand('contextGenerator.generateContext', () => {
        const selectedFiles = treeDataProvider.getAllCheckedFiles();

        if (selectedFiles.length === 0) {
            vscode.window.showWarningMessage('No files selected. Please select at least one file to generate context.');
            return;
        }

        const config = vscode.workspace.getConfiguration('contextGenerator');
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

        generateContext(workspaceRoot, outputFile, filteredFiles, excludeFiles, excludePaths, excludeHidden);
    });

    vscode.commands.registerCommand('contextGenerator.selectAll', async () => {
        const allFilePaths = await getAllFiles(workspaceRoot);
        allFilePaths.forEach(filePath => {
            if (!checkedFiles.has(filePath)) {
                checkedFiles.add(filePath);
                console.log(`Added: ${filePath}`);
            }
        });
        treeDataProvider.refresh();
        context.globalState.update('checkedFiles', Array.from(checkedFiles));
    });

    vscode.commands.registerCommand('contextGenerator.deselectAll', () => {
        checkedFiles.forEach(filePath => {
            console.log(`Removed: ${filePath}`);
        });
        checkedFiles.clear();
        treeDataProvider.refresh();
        context.globalState.update('checkedFiles', []);
    });
}

export function deactivate() {}

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
        vscode.window.showErrorMessage(`Error reading directory ${dirPath}: ${err}`);
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