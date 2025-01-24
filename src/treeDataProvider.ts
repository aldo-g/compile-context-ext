/**
 * Provides data for the File Tree View in the Compile Context extension.
 */
import * as vscode from 'vscode';
import * as path from 'path';
import { FileNode } from './models/FileNode';
import * as fs from 'fs';

/**
 * Provides the structure and data for the Tree View in the Compile Context extension.
 */
export class FileTreeProvider implements vscode.TreeDataProvider<FileNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileNode | undefined | void> = new vscode.EventEmitter<FileNode | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<FileNode | undefined | void> = this._onDidChangeTreeData.event;

    /**
     * Initializes the FileTreeProvider with the workspace root and the set of checked files.
     * @param workspaceRoot The root directory of the workspace.
     * @param checkedFiles A set containing the paths of checked files.
     */
    constructor(private workspaceRoot: string, private checkedFiles: Set<string>) {}

    /**
     * Refreshes the entire Tree View.
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Refreshes a specific FileNode in the Tree View.
     * @param node The FileNode to refresh.
     */
    refreshNode(node: FileNode): void {
        this._onDidChangeTreeData.fire(node);
    }

    /**
     * Retrieves the TreeItem representation of a FileNode.
     * @param element The FileNode to represent.
     * @returns A configured TreeItem.
     */
    getTreeItem(element: FileNode): vscode.TreeItem {
        const selectionSymbol = this.getSelectionSymbol(element);
        const treeItem = new vscode.TreeItem(`${selectionSymbol} ${path.basename(element.label)}`, element.collapsibleState);
        treeItem.resourceUri = element.uri;
        treeItem.command = {
            command: 'compileContext.toggleCheckbox',
            title: '',
            arguments: [element]
        };

        // Assign a stable unique ID based on the file path
        treeItem.id = element.uri.fsPath;

        if (element.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
            treeItem.iconPath = new vscode.ThemeIcon('folder');
        } else {
            const icon = getFileIcon(element.label);
            treeItem.iconPath = icon ? new vscode.ThemeIcon(icon) : new vscode.ThemeIcon('file');
        }

        treeItem.tooltip = element.uri.fsPath;

        return treeItem;
    }

    /**
     * Retrieves the children of a given FileNode or the root if no element is provided.
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
     * Generates an array of FileNodes for a specific directory path.
     * Directories are listed first in alphabetical order, followed by files in alphabetical order.
     * @param dirPath The directory path to generate FileNodes for.
     * @returns An array of FileNodes.
     */
    private getFileNodes(dirPath: string): FileNode[] {
        let entries: string[];
        try {
            entries = fs.readdirSync(dirPath);
        } catch (err) {
            vscode.window.showErrorMessage(`Unable to read directory: ${dirPath}`);
            return [];
        }

        const config = vscode.workspace.getConfiguration('compileContext');
        const excludeHidden: boolean = config.get('excludeHidden') ?? true;

        const directories: string[] = [];
        const files: string[] = [];

        entries.forEach(entry => {
            if (excludeHidden && entry.startsWith('.')) {
                return;
            }
            const fullPath = path.join(dirPath, entry);
            let stats: fs.Stats;
            try {
                stats = fs.statSync(fullPath);
            } catch (err) {
                vscode.window.showErrorMessage(`Unable to access file: ${fullPath}`);
                return;
            }
            if (stats.isDirectory()) {
                directories.push(entry);
            } else {
                files.push(entry);
            }
        });

        directories.sort((a, b) => a.localeCompare(b));
        files.sort((a, b) => a.localeCompare(b));

        const sortedEntries = [...directories, ...files];

        return sortedEntries.map(file => {
            const fullPath = path.join(dirPath, file);
            let stats: fs.Stats;
            try {
                stats = fs.statSync(fullPath);
            } catch (err) {
                vscode.window.showErrorMessage(`Unable to access file: ${fullPath}`);
                return null;
            }

            const isDirectory = stats.isDirectory();

            let checked = false;
            if (isDirectory) {
                const allChildFilePaths = getAllChildFilesSync(fullPath);
                const allSelected = allChildFilePaths.length > 0 && allChildFilePaths.every(filePath => this.checkedFiles.has(filePath));
                const someSelected = allChildFilePaths.some(filePath => this.checkedFiles.has(filePath));
                checked = allSelected;
            } else {
                checked = this.checkedFiles.has(fullPath);
            }

            const fileNode: FileNode = {
                label: file + (isDirectory ? path.sep : ''),
                collapsibleState: isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                uri: vscode.Uri.file(fullPath),
                checked: checked
            };

            return fileNode;
        }).filter(node => node !== null) as FileNode[];
    }

    /**
     * Retrieves all currently checked FileNodes.
     * @returns An array of checked FileNodes.
     */
    getAllCheckedFiles(): FileNode[] {
        const checkedFileNodes: FileNode[] = [];

        this.checkedFiles.forEach(filePath => {
            try {
                const stats = fs.statSync(filePath);
                const isDir = stats.isDirectory();
                checkedFileNodes.push({
                    label: path.basename(filePath) + (isDir ? path.sep : ''),
                    collapsibleState: isDir ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                    uri: vscode.Uri.file(filePath),
                    checked: true
                } as FileNode);
            } catch (err) {
                console.error(`Error accessing file ${filePath}:`, err);
            }
        });

        return checkedFileNodes;
    }

    /**
     * Determines the selection symbol based on the selection state of the FileNode.
     * @param element The FileNode to evaluate.
     * @returns A Unicode circle symbol representing the selection state.
     */
    private getSelectionSymbol(element: FileNode): string {
        if (element.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
            const allChildFilePaths = getAllChildFilesSync(element.uri.fsPath);
            const allSelected = allChildFilePaths.length > 0 && allChildFilePaths.every(filePath => this.checkedFiles.has(filePath));
            const someSelected = allChildFilePaths.some(filePath => this.checkedFiles.has(filePath));

            if (allSelected) {
                return '●';
            } else if (someSelected) {
                return '◑';
            } else {
                return '○';
            }
        } else {
            return element.checked ? '●' : '○';
        }
    }

    /**
     * Retrieves the parent FileNode of a given FileNode.
     * @param element The FileNode whose parent is to be found.
     * @returns The parent FileNode or undefined if at root.
     */
    getParent(element: FileNode): vscode.ProviderResult<FileNode> {
        const parentPath = path.dirname(element.uri.fsPath);
        if (parentPath === this.workspaceRoot) {
            return undefined; // Root has no parent
        }
        try {
            const stats = fs.statSync(parentPath);
            if (stats.isDirectory()) {
                return {
                    label: path.basename(parentPath) + path.sep,
                    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                    uri: vscode.Uri.file(parentPath),
                    checked: this.checkedFiles.has(parentPath)
                } as FileNode;
            }
            return undefined;
        } catch (err) {
            console.error(`Error accessing parent directory ${parentPath}:`, err);
            return undefined;
        }
    }
}

/**
 * Recursively collects all file paths under a given directory synchronously.
 * @param dirPath The directory path to traverse.
 * @returns An array of file paths.
 */
function getAllChildFilesSync(dirPath: string): string[] {
    let results: string[] = [];

    try {
        const list = fs.readdirSync(dirPath, { withFileTypes: true });
        list.forEach(dirent => {
            const filePath = path.join(dirPath, dirent.name);
            if (dirent.isDirectory()) {
                results = results.concat(getAllChildFilesSync(filePath));
            } else if (dirent.isFile()) {
                results.push(filePath);
            }
        });
    } catch (err) {
        console.error(`Error traversing directory ${dirPath}:`, err);
        vscode.window.showErrorMessage(`Error traversing directory ${dirPath}: ${err}`);
    }

    return results;
}

/**
 * Determines the appropriate ThemeIcon based on the file extension.
 * @param filename The name of the file.
 * @returns A string representing the ThemeIcon name.
 */
function getFileIcon(filename: string): string | undefined {
    const extension = path.extname(filename).toLowerCase();
    switch (extension) {
        case '.js':
        case '.jsx':
            return 'javascript';
        case '.ts':
        case '.tsx':
            return 'typescript';
        case '.py':
            return 'python';
        case '.md':
            return 'markdown';
        case '.json':
            return 'json';
        case '.html':
            return 'html';
        case '.css':
            return 'css';
        case '.jsonc':
            return 'json';
        default:
            return undefined;
    }
}