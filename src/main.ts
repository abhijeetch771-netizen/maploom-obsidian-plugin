import { Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import { MaploomView, VIEW_TYPE_MAPLOOM } from './views/maploom-view';

export default class MaploomPlugin extends Plugin {
  async onload(): Promise<void> {
    this.registerView(VIEW_TYPE_MAPLOOM, (leaf) => new MaploomView(leaf));
    this.addRibbonIcon('git-branch', 'Open Maploom', () => this.openMap());
    this.addCommand({ id: 'open-map', name: 'Open Maploom for the active note', callback: () => this.openMap() });
    this.addCommand({ id: 'refresh-map', name: 'Refresh Maploom', callback: () => this.refreshMap() });
    this.registerEvent(this.app.workspace.on('file-open', () => this.refreshMap()));
  }
  onunload(): void { this.app.workspace.detachLeavesOfType(VIEW_TYPE_MAPLOOM); }
  private async openMap(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) { new Notice('Maploom: open a Markdown note first.'); return; }
    let leaf: WorkspaceLeaf | null = this.app.workspace.getLeavesOfType(VIEW_TYPE_MAPLOOM)[0] ?? null;
    if (!leaf) leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) { new Notice('Maploom: could not create a workspace pane.'); return; }
    await leaf.setViewState({ type: VIEW_TYPE_MAPLOOM, active: true });
    this.app.workspace.revealLeaf(leaf);
    const view = leaf.view;
    if (view instanceof MaploomView) await view.setSourceFile(file);
  }
  private async refreshMap(): Promise<void> {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_MAPLOOM)) {
      const view = leaf.view;
      if (view instanceof MaploomView) await view.refreshFromActiveFile();
    }
  }
}
