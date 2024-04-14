import {
	App,
	FuzzySuggestModal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	TFolder,
} from "obsidian";

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: "default",
};

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "copy-note",
			name: "Copy",
			callback: async () => {
				const folderPicker = new FolderSuggestModal(
					this.app,
					this.copyNote
				);
				folderPicker.open();
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		// this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {}

	async copyNote(dest: TFolder) {
		const note = this.app.workspace.getActiveFile();
		if (!note) {
			new Notice("No note is active");
			return;
		}

		const noteCache = this.app.metadataCache.getFileCache(note);
		if (!noteCache) {
			new Notice("No metadata found the active note");
			return;
		}

		const { links, embeds } = noteCache;
		const attachments = [links ?? [], embeds ?? []]
			.flat()
			.map((l) => this.app.vault.getAbstractFileByPath(l.link))
			.filter(
				(f) => f instanceof TFile && f.extension != "md"
			) as TFile[];

		const destDir = dest.path;
		// Copy the note to the destination folder
		const toCopy: { src: TFile; dest: string }[] = [
			{
				src: note,
				dest: `${destDir}/${note.name}`,
			},
		];
		// Copy all attachments referenced in the note
		for (const attachment of attachments) {
			toCopy.push({
				src: attachment!,
				dest: `${destDir}/attachments/${attachment!.name}`,
			});
		}

		for (const copy of toCopy) {
			const existing = this.app.vault.getAbstractFileByPath(copy.dest);
			// skip if it is the same file
			if (copy.src.path === existing?.path) {
				continue;
				// delete if target file already exists
			} else if (existing) {
				this.app.vault.delete(existing);
			}
			await this.app.vault.copy(copy.src, copy.dest);
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

type folderModalCallback = (folder: TFolder) => Promise<void>;
class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
	callback: folderModalCallback;

	constructor(app: App, callback: folderModalCallback) {
		super(app);
		this.callback = callback;
	}

	getItems(): TFolder[] {
		const abstractFiles = app.vault.getAllLoadedFiles();
		const folders: TFolder[] = [];

		abstractFiles.forEach((folder) => {
			if (folder instanceof TFolder) {
				folders.push(folder);
			}
		});

		return folders;
	}

	getItemText(item: TFolder): string {
		return item.name;
	}

	onChooseItem(item: TFolder, evt: MouseEvent | KeyboardEvent): void {
		this.callback(item);
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Setting #1")
			.setDesc("It's a secret")
			.addText((text) =>
				text
					.setPlaceholder("Enter your secret")
					.setValue(this.plugin.settings.mySetting)
					.onChange(async (value) => {
						this.plugin.settings.mySetting = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
