import {
	App,
	Editor,
	FuzzySuggestModal,
	MarkdownView,
	Modal,
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

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(
			"dice",
			"Sample Plugin",
			(evt: MouseEvent) => {
				// Called when the user clicks the icon.
				new Notice("This is a notice!");
			}
		);
		// Perform additional things with the ribbon
		ribbonIconEl.addClass("my-plugin-ribbon-class");

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("Status Bar Text");

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: "open-sample-modal-simple",
			name: "Open sample modal (simple)",
			callback: () => {
				new SampleModal(this.app).open();
			},
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: "sample-editor-command",
			name: "Sample editor command",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection("Sample Editor Command");
			},
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: "open-sample-modal-complex",
			name: "Open sample modal (complex)",
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			},
		});

		this.addCommand({
			id: "copy-note",
			name: "Copy note",
			callback: async () => {
				const folderPicker = new FolderSuggestModal(
					this.app,
					this.copyNote
				);
				folderPicker.open();
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, "click", (evt: MouseEvent) => {
			console.log("click", evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000)
		);
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

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText("Woah!");
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
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
