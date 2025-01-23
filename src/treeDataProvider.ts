// src/treeDataProvider.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { FileNode } from './models/FileNode';
import * as fs from 'fs';

/**
 * Provides data for the File Tree View.
 */
export class FileTreeProvider implements vscode.TreeDataProvider<FileNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileNode | undefined | void> = new vscode.EventEmitter<FileNode | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<FileNode | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string, private checkedFiles: Set<string>) {}

    /**
     * Refreshes the Tree View.
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Returns the TreeItem representation of a FileNode.
     * @param element The FileNode to represent.
     * @returns A TreeItem.
     */
    getTreeItem(element: FileNode): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(element.label, element.collapsibleState);
        treeItem.resourceUri = element.uri;
        treeItem.command = {
            command: 'contextGenerator.toggleCheckbox',
            title: '',
            arguments: [element]
        };

        // Set icons based on checked state
        if (element.checked) {
            treeItem.iconPath = new vscode.ThemeIcon('check');
        } else {
            treeItem.iconPath = new vscode.ThemeIcon('circle-outline');
        }

        // Tooltip
        treeItem.tooltip = element.uri.fsPath;

        return treeItem;
    }

    /**
     * Returns the children of a given FileNode.
     * @param element The parent FileNode.
     * @returns A promise resolving to an array of FileNodes.
     */
    getChildren(element?: FileNode): Thenable<FileNode[]> {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No workspace folder found');
            return Promise.resolve([]);
        }

        if (element) {
            return Promise.resolve(this.getFileNodes(element.uri.fsPath));
        } else {
            return Promise.resolve(this.getFileNodes(this.workspaceRoot));
        }
    }

    /**
     * Retrieves FileNodes within a given directory path.
     * @param dirPath The directory path.
     * @returns An array of FileNodes.
     */
    private getFileNodes(dirPath: string): FileNode[] {
        let files: string[];
        try {
            files = fs.readdirSync(dirPath);
        } catch (err) {
            vscode.window.showErrorMessage(`Unable to read directory: ${dirPath}`);
            return [];
        }

        // Fetch configuration
        const config = vscode.workspace.getConfiguration('contextGenerator');
        const excludeHidden: boolean = config.get('excludeHidden') ?? true;

        return files.map(file => {
            const fullPath = path.join(dirPath, file);
            let stats: fs.Stats;
            try {
                stats = fs.statSync(fullPath);
            } catch (err) {
                vscode.window.showErrorMessage(`Unable to access file: ${fullPath}`);
                return null;
            }

            const isDirectory = stats.isDirectory();
            const relativePath = path.relative(this.workspaceRoot, fullPath);
            const checked = this.checkedFiles.has(fullPath);

            // Exclude hidden files/directories if configured
            if (excludeHidden && file.startsWith('.')) {
                return null;
            }

            return {
                label: file + (isDirectory ? path.sep : ''),
                collapsibleState: isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                uri: vscode.Uri.file(fullPath),
                checked: checked,
                children: isDirectory ? [] : undefined
            } as FileNode;
        }).filter(node => node !== null) as FileNode[];
    }

    /**
     * Returns an array of FileNodes that are currently checked.
     * @returns An array of checked FileNodes.
     */
    getAllCheckedFiles(): FileNode[] {
        const checkedFileNodes: FileNode[] = [];

        this.checkedFiles.forEach(filePath => {
            checkedFileNodes.push({
                label: path.basename(filePath),
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                uri: vscode.Uri.file(filePath),
                checked: true
            } as FileNode);
        });

        console.log(`getAllCheckedFiles: ${checkedFileNodes.map(file => file.uri.fsPath).join(', ')}`);

        return checkedFileNodes;
    }

    /**
     * Updates the checkedFiles Set.
     * @param paths Array of file paths to set as checked.
     */
    setCheckedFiles(paths: string[]) {
        this.checkedFiles = new Set(paths);
    }
}