// src/treeDataProvider.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { FileNode } from './models/FileNode';
import * as fs from 'fs';

export class FileTreeProvider implements vscode.TreeDataProvider<FileNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileNode | undefined | void> = new vscode.EventEmitter<FileNode | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<FileNode | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string, private checkedFiles: Set<string>) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

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

    private getFileNodes(dirPath: string): FileNode[] {
        let files: string[];
        try {
            files = fs.readdirSync(dirPath);
        } catch (err) {
            vscode.window.showErrorMessage(`Unable to read directory: ${dirPath}`);
            return [];
        }

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

            return {
                label: file + (isDirectory ? path.sep : ''),
                collapsibleState: isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                uri: vscode.Uri.file(fullPath),
                checked: checked,
                children: isDirectory ? [] : undefined
            } as FileNode;
        }).filter(node => node !== null) as FileNode[];
    }

    getAllCheckedFiles(): FileNode[] {
        const checkedFiles: FileNode[] = [];
        const traverse = (nodes: FileNode[]) => {
            nodes.forEach(node => {
                if (node.checked && !node.children) {
                    checkedFiles.push(node);
                }
                if (node.children) {
                    traverse(node.children);
                }
            });
        };
        traverse(this.getFileNodes(this.workspaceRoot));
        return checkedFiles;
    }

    setCheckedFiles(paths: string[]) {
        this.checkedFiles = new Set(paths);
    }
}