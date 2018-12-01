/* exported Lockscreen */
/* global pkg */

const {Gio, GLib, GObject, Gtk} = imports.gi;

const {Playbin} = imports.playbin;

var Lockscreen = GObject.registerClass({
    GTypeName: 'Lockscreen',
    CssName: 'lockscreen',
    Properties: {
        locked: GObject.ParamSpec.boolean('locked', 'Locked', '',
            GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
            true),
        key: GObject.ParamSpec.string('key', 'Key', '',
            GObject.ParamFlags.READWRITE, ''),
        lock: GObject.ParamSpec.string('lock', 'lock', '',
            GObject.ParamFlags.READWRITE, ''),
    },
}, class Lockscreen extends Gtk.Overlay {
    _init(props = {}) {
        super._init(props);

        this._playbin = new Playbin({
            expand: true,
            noShowAll: true,
        });

        this._playbin.connect('clicked', this._onClicked.bind(this));

        this._playbin.connect('done', () => {
            this._playbin.hide();
        });

        this.add_overlay(this._playbin);

        this._manager = Gio.Application.get_default().locksManager;
        this._keyChangedId = 0;
        this._lockChangedId = 0;
        this._updateUI();
    }

    get locked() {
        return this._locked;
    }

    set locked(value) {
        if ('_locked' in this && this._locked === value)
            return;
        this._locked = value;
        this._updateUI();
        this.notify('locked');
    }

    get key() {
        return this._key;
    }

    set key(key) {
        if ('_key' in this && this._key === key)
            return;
        if (this._keyChangedId !== 0)
            this._manager.disconnect(this._keyChangedId);
        this._keyChangedId = this._manager.connect(
            `changed::${key}`, this._updateLockStateWithKey.bind(this));
        this._key = key;
        this._updateLockStateWithKey();
    }

    get lock() {
        return this._lock;
    }

    set lock(lock) {
        if ('_lock' in this && this._lock === lock)
            return;
        if (this._lockChangedId !== 0)
            this._manager.disconnect(this._lockChangedId);
        this._lockChangedId = this._manager.connect(
            `changed::${lock}`, this._updateLockStateWithLock.bind(this));
        this._lock = lock;
        this._updateLockStateWithLock();
    }

    _updateBackground () {
        const defaultPath = GLib.build_filenamev([pkg.pkgdatadir, 'lockscreens', 'default']);
        var assetsHasKey = false;
        var assetsPath;
        var videoPath;

        if (this._lock) {
            const path = GLib.build_filenamev([pkg.pkgdatadir, 'lockscreens', this._lock]);
            const dir = Gio.File.new_for_path(path);

            if (dir.query_exists(null) &&
                dir.get_child('no-key').query_exists(null)) {
                // All the required assets are here, let's use this path for the background
                assetsPath = path;

                // Now check the optional assets
                assetsHasKey = dir.get_child('has-key').query_exists(null);

                if (dir.get_child('open.webm').query_exists(null))
                    videoPath = assetsPath;
            }
        }

        if (!assetsPath)
            assetsPath = defaultPath;
        if (!videoPath)
            videoPath = defaultPath;

        this._openURI = `file://${videoPath}/open.webm`;

        if (assetsHasKey && this._key && this._manager.hasKey(this._key))
            this._playbin.setBackground(`file://${assetsPath}/has-key`);
        else
            this._playbin.setBackground(`file://${assetsPath}/no-key`);
    }

    _updateLockStateWithKey() {
        if (!this._key)
            return;
        this._updateBackground();
    }

    _updateLockStateWithLock() {
        this._playbin.hasLock = !!this._lock;

        if (!this._lock)
            return;

        this._updateBackground();

        if (!this._manager.isUnlocked(this._lock))
            return;
        this.locked = false;
    }

    _onClicked() {
        if (!this.locked)
            return;

        if (this._manager.hasKey('item.key.master')) {
            this.locked = false;
            return;
        }
        if (!this._key || !this._lock)
            return;
        if (!this._manager.hasKey(this._key))
            return;

        /* We are going to need to playback an animation */
        if (this._openURI)
            this._playbin.uri = this._openURI;

        this._manager.setUnlocked(this._lock);
        this._manager.setUsed(this._key);
    }

    _updateUI() {
        if (!this._playbin)
            return;

        this._playbin.hasLock = !!this._lock;
        this._playbin.locked = this._locked;

        if (this._locked) {
            this._playbin.show();
        } else if (this._openURI) {
            this._playbin.show();
            this._playbin.play();
        } else {
            this._playbin.hide();
        }
    }
});
