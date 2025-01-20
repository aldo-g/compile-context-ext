// src/models/FileNode.ts
import * as vscode from 'vscode';

export interface FileNode {
    label: string;
    collapsibleState: vscode.TreeItemCollapsibleState;
    uri: vscode.Uri;
    checked: boolean;
    children?: FileNode[];
}