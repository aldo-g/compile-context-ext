// src/extension.ts
import * as vscode from 'vscode';
import { FileTreeProvider } from './treeDataProvider';
import { FileNode } from './models/FileNode';
import { generateContext } from './generateContext';
import * as path from 'path';
import * as fs from 'fs/promises';

export function activate(context: vscode.ExtensionContext) {
    const workspaceRoot = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : '';

    // Load persisted selections from global state
    const persistedSelections: string[] = context.globalState.get('checkedFiles', []);
    const checkedFiles = new Set<string>(persistedSelections);

    console.log(`Persisted checked files: ${persistedSelections.join(', ')}`);

    const treeDataProvider = new FileTreeProvider(workspaceRoot, checkedFiles);
    vscode.window.registerTreeDataProvider('contextGeneratorView', treeDataProvider);

    vscode.commands.registerCommand('contextGenerator.toggleCheckbox', async (element: FileNode) => {
        if (isDirectory(element)) {
            // If it's a directory, toggle all child files
            const isChecked = checkedFiles.has(element.uri.fsPath);
            const allChildFilePaths = await getAllChildFiles(element.uri.fsPath);

            console.log(`Toggling directory: ${element.uri.fsPath}`);
            console.log(`All child files to process: ${allChildFilePaths.join(', ')}`);

            if (isChecked) {
                // Deselect all child files
                allChildFilePaths.forEach(filePath => checkedFiles.delete(filePath));
                console.log(`Unchecked all children of ${element.uri.fsPath}`);
            } else {
                // Select all child files
                allChildFilePaths.forEach(filePath => checkedFiles.add(filePath));
                console.log(`Checked all children of ${element.uri.fsPath}`);
            }
        } else {
            // It's a file, toggle its selection
            if (element.checked) {
                checkedFiles.delete(element.uri.fsPath);
                console.log(`Unchecked: ${element.uri.fsPath}`);
            } else {
                checkedFiles.add(element.uri.fsPath);
                console.log(`Checked: ${element.uri.fsPath}`);
            }
        }

        treeDataProvider.refresh();

        // Persist the selection
        const allCheckedFiles = Array.from(checkedFiles);
        context.globalState.update('checkedFiles', allCheckedFiles);
        console.log(`Current checked files: ${allCheckedFiles.join(', ')}`);
    });

    vscode.commands.registerCommand('contextGenerator.generateContext', () => {
        const selectedFiles = treeDataProvider.getAllCheckedFiles();
        console.log(`Generating context for files: ${selectedFiles.map(file => file.uri.fsPath).join(', ')}`);

        if (selectedFiles.length === 0) {
            vscode.window.showWarningMessage('No files selected. Please select at least one file to generate context.');
            return;
        }

        const config = vscode.workspace.getConfiguration('contextGenerator');
        const outputFile: string = config.get('outputFile') || 'file_context.txt';
        const excludeFiles: string[] = config.get('excludeFiles') || [];
        const excludePaths: string[] = config.get('excludePaths') || [];
        const excludeHidden: boolean = config.get('excludeHidden') ?? true;

        // Filter selectedFiles based on excludeFiles and excludePaths
        const filteredFiles = selectedFiles.filter(file => {
            const fileName = path.basename(file.uri.fsPath);
            const relativePath = path.relative(workspaceRoot, file.uri.fsPath).replace(/\\/g, '/');

            // Exclude based on file names
            if (excludeFiles.includes(fileName)) {
                console.log(`Excluding file by name: ${fileName}`);
                return false;
            }

            // Exclude based on paths
            if (excludePaths.some(excludePath => relativePath.startsWith(excludePath))) {
                console.log(`Excluding file by path: ${relativePath}`);
                return false;
            }

            // Exclude hidden files/directories if configured
            if (excludeHidden && isHidden(relativePath)) {
                console.log(`Excluding hidden file: ${relativePath}`);
                return false;
            }

            return true;
        });

        if (filteredFiles.length === 0) {
            vscode.window.showWarningMessage('No files to include after applying exclusions.');
            return;
        }

        console.log(`Filtered files to include: ${filteredFiles.map(file => file.uri.fsPath).join(', ')}`);

        generateContext(workspaceRoot, outputFile, filteredFiles, excludeFiles, excludePaths, excludeHidden);
    });
}

export function deactivate() {}

/**
 * Determines if a FileNode represents a directory.
 * @param node The FileNode to check.
 * @returns True if it's a directory, else false.
 */
function isDirectory(node: FileNode): boolean {
    return node.collapsibleState !== vscode.TreeItemCollapsibleState.None;
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

    console.log(`Collected child files for ${dirPath}: ${results.join(', ')}`);
    return results;
}

/**
 * Determines if a file or directory is hidden based on its relative path.
 * @param relativePath The path relative to the workspace root.
 * @returns True if hidden, else false.
 */
function isHidden(relativePath: string): boolean {
    return relativePath.split(path.sep).some(part => part.startsWith('.'));
}