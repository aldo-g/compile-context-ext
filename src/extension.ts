// src/extension.ts
import * as vscode from 'vscode';
import { FileTreeProvider } from './treeDataProvider';
import { FileNode } from './models/FileNode';
import { generateContext } from './generateContext';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    const workspaceRoot = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : '';

    // Load persisted selections from global state
    const persistedSelections: string[] = context.globalState.get('checkedFiles', []);
    const checkedFiles = new Set<string>(persistedSelections);

    const treeDataProvider = new FileTreeProvider(workspaceRoot, checkedFiles);
    vscode.window.registerTreeDataProvider('contextGeneratorView', treeDataProvider);

    vscode.commands.registerCommand('contextGenerator.toggleCheckbox', (element: FileNode) => {
        if (element.checked) {
            checkedFiles.delete(element.uri.fsPath);
        } else {
            checkedFiles.add(element.uri.fsPath);
        }
        treeDataProvider.refresh();

        // Persist the selection
        const allCheckedFiles = Array.from(checkedFiles);
        context.globalState.update('checkedFiles', allCheckedFiles);
    });

    vscode.commands.registerCommand('contextGenerator.generateContext', () => {
        const selectedFiles = treeDataProvider.getAllCheckedFiles();
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
                return false;
            }

            // Exclude based on paths
            if (excludePaths.some(excludePath => relativePath.startsWith(excludePath))) {
                return false;
            }

            return true;
        });

        generateContext(workspaceRoot, outputFile, filteredFiles, excludeFiles, excludePaths, excludeHidden);
    });
}

export function deactivate() {}