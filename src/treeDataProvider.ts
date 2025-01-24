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
     * Initializes the FileTreeProvider with a workspace root and a set of checked files.
     */
    constructor(private workspaceRoot: string, private checkedFiles: Set<string>) {}

    /**
     * Refreshes the entire Tree View.
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Refreshes a specific node in the Tree View.
     */
    refreshNode(node: FileNode): void {
        this._onDidChangeTreeData.fire(node);
    }

    /**
     * Returns a TreeItem for a FileNode.
     */
    getTreeItem(element: FileNode): vscode.TreeItem {
        const symbol = this.getSelectionSymbol(element);
        const treeItem = new vscode.TreeItem(`${symbol} ${path.basename(element.label)}`, element.collapsibleState);
        treeItem.resourceUri = element.uri;
        treeItem.command = {
            command: 'compileContext.toggleCheckbox',
            title: '',
            arguments: [element]
        };
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
     * Returns the children of a FileNode or the root directory if none is given.
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
     * Builds FileNodes from a directory path, applying exclusions for paths or hidden entries.
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
        const excludePaths: string[] = config.get('excludePaths') || [];
        const dirs: string[] = [];
        const files: string[] = [];
        entries.forEach(e => {
            if (excludeHidden && e.startsWith('.')) return;
            const fp = path.join(dirPath, e);
            const rel = path.relative(this.workspaceRoot, fp).replace(/\\/g, '/');
            if (excludePaths.some(pth => rel.startsWith(pth))) return;
            let stats: fs.Stats;
            try {
                stats = fs.statSync(fp);
            } catch {
                return;
            }
            if (stats.isDirectory()) {
                dirs.push(e);
            } else {
                files.push(e);
            }
        });
        dirs.sort((a, b) => a.localeCompare(b));
        files.sort((a, b) => a.localeCompare(b));
        const sorted = [...dirs, ...files];
        return sorted.map(e => {
            const fp = path.join(dirPath, e);
            let stats: fs.Stats;
            try {
                stats = fs.statSync(fp);
            } catch {
                return null;
            }
            const isDir = stats.isDirectory();
            let checked = false;
            if (isDir) {
                const child = getAllChildFilesSync(fp);
                const allSel = child.every(f => this.checkedFiles.has(f));
                checked = allSel;
            } else {
                checked = this.checkedFiles.has(fp);
            }
            const node: FileNode = {
                label: e + (isDir ? path.sep : ''),
                collapsibleState: isDir ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                uri: vscode.Uri.file(fp),
                checked
            };
            return node;
        }).filter(n => n !== null) as FileNode[];
    }

    /**
     * Retrieves all checked files, constructing FileNodes as needed.
     */
    getAllCheckedFiles(): FileNode[] {
        const arr: FileNode[] = [];
        this.checkedFiles.forEach(fp => {
            try {
                const stats = fs.statSync(fp);
                const isDir = stats.isDirectory();
                arr.push({
                    label: path.basename(fp) + (isDir ? path.sep : ''),
                    collapsibleState: isDir ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                    uri: vscode.Uri.file(fp),
                    checked: true
                });
            } catch {}
        });
        return arr;
    }

    /**
     * Determines which circle symbol (●, ◑, ○) to display for a FileNode.
     */
    private getSelectionSymbol(e: FileNode): string {
        if (e.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
            const child = getAllChildFilesSync(e.uri.fsPath);
            const allSel = child.length > 0 && child.every(f => this.checkedFiles.has(f));
            const someSel = child.some(f => this.checkedFiles.has(f));
            if (allSel) return '●';
            if (someSel) return '◑';
            return '○';
        } else {
            return e.checked ? '●' : '○';
        }
    }

    /**
     * Returns the parent FileNode of a given node by constructing its path.
     */
    getParent(e: FileNode): vscode.ProviderResult<FileNode> {
        const par = path.dirname(e.uri.fsPath);
        if (par === this.workspaceRoot) return undefined;
        try {
            const st = fs.statSync(par);
            if (st.isDirectory()) {
                return {
                    label: path.basename(par) + path.sep,
                    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                    uri: vscode.Uri.file(par),
                    checked: this.checkedFiles.has(par)
                };
            }
        } catch {}
        return undefined;
    }
}

/**
 * Recursively collects file paths in a directory synchronously.
 */
function getAllChildFilesSync(dirPath: string): string[] {
    let results: string[] = [];
    try {
        const list = fs.readdirSync(dirPath, { withFileTypes: true });
        list.forEach(d => {
            const fp = path.join(dirPath, d.name);
            if (d.isDirectory()) {
                results = results.concat(getAllChildFilesSync(fp));
            } else if (d.isFile()) {
                results.push(fp);
            }
        });
    } catch {}
    return results;
}

/**
 * Determines an icon for a file based on its extension.
 */
function getFileIcon(name: string): string | undefined {
    const ext = path.extname(name).toLowerCase();
    switch (ext) {
        case '.js':
        case '.jsx': return 'javascript';
        case '.ts':
        case '.tsx': return 'typescript';
        case '.py': return 'python';
        case '.md': return 'markdown';
        case '.json': return 'json';
        case '.html': return 'html';
        case '.css': return 'css';
        case '.jsonc': return 'json';
        default: return undefined;
    }
}