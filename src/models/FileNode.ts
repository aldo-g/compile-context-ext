// src/models/FileNode.ts
import * as vscode from 'vscode';

/**
 * Defines the structure of a file or directory node in the Tree View.
 */
export interface FileNode {
    label: string;
    collapsibleState: vscode.TreeItemCollapsibleState;
    uri: vscode.Uri;
    checked: boolean;
}