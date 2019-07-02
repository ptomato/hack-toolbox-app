/* exported SketchToolbox */

const {GObject} = imports.gi;

const {SketchMetadataTopic} = imports.sketchbook.metadata;
const {SketchModel} = imports.sketchbook.model;
const {SketchCodeTopic} = imports.sketchbook.code;
const {Toolbox} = imports.toolbox;

var SketchToolbox = GObject.registerClass(class SketchToolbox extends Toolbox {
    _init(appId, props = {}) {
        super._init(appId, props);

        this._model = new SketchModel();
        this._model.initAsync()
            .then(this._completeInit.bind(this))
            .catch(logError);

        this._codeTopic = new SketchCodeTopic();
        this.addTopic('code', 'Code', 'accessories-text-editor-symbolic',
            this._codeTopic);
        this.showTopic('code');
        this.selectTopic('code');

        this._metadataTopic = new SketchMetadataTopic();
        this.addTopic('metadata', 'About', 'document-edit-symbolic',
            this._metadataTopic);
        this.showTopic('metadata');
    }

    _completeInit() {
        this._codeTopic.bindModel(this._model);
        this._metadataTopic.bindModel(this._model);

        this._updateTitle();
        this.show_all();

        this._updateTitleHandler = this._model.connect('notify::title',
            this._updateTitle.bind(this));
        this.connect('reset', () => this._model.reset());
    }

    bindWindow(win) {
        win.get_style_context().add_class('Sketchbook');
        win.get_style_context().add_class('Sidetrack');  // use Sidetrack shader
        win.lockscreen.key = 'item.key.sidetrack.1';
        win.lockscreen.lock = 'lock.sidetrack.1';
        win.connect('focus-out-event', this._onWindowFocusOut.bind(this));
    }

    _onWindowFocusOut() {
        // If we enable the flip-back action, then we're entirely reponsible for
        // shutting down and restarting the app. We don't want that. Instead,
        // try using "focus out" as a rough approximation of flipping back, and
        // refresh the front of the app in that case.
        if (this._model && this._model.needsRefresh)
            this._model.refresh();
    }

    _updateTitle() {
        const text = this._model.title ? `“${this._model.title}”` : 'Untitled';
        this.setInfo(text);
    }

    shutdown() {
        super.shutdown();

        if (this._model && this._updateTitleHandler) {
            this._model.disconnect(this._updateTitleHandler);
            this._model = null;
            this._updateTitleHandler = null;
        }

        this._metadataTopic.unbindModel();
        this._codeTopic.unbindModel();
    }
});

