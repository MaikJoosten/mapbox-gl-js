// @flow

import { Event, Evented } from '../util/evented';
import window from '../util/window';

let pluginRequested = false;
let pluginURL = null;
let foregroundLoadComplete = false;

const isAbsoluteUrl = (url) => {
    // handles https, http, and protocol-relative URLs
    const isAbsolute = new RegExp('^([a-z]+://|//)', 'i');
    return isAbsolute.exec(url);
};

const resolvePluginUrl = (path) => {
    if (isAbsoluteUrl(path)) {
        return path;
    }
    // resolves from root URL
    // if path begins with a '/', it will be appended to the domain
    // otherwise, it will be appended to the full path
    const a = window.document.createElement('a');
    a.href = path;
    return a.href;
};

export const evented = new Evented();

type CompletionCallback = (error?: Error) => void;
type ErrorCallback = (error: Error) => void;

let _completionCallback;

export const registerForPluginAvailability = function(
    callback: (args: {pluginURL: string, completionCallback: CompletionCallback}) => void
) {
    if (pluginURL) {
        callback({ pluginURL: pluginURL, completionCallback: _completionCallback});
    } else {
        evented.once('pluginAvailable', callback);
    }
    return callback;
};

export const clearRTLTextPlugin = function() {
    pluginRequested = false;
    pluginURL = null;
};

export const setRTLTextPlugin = function(url: string, callback: ErrorCallback) {
    if (pluginRequested) {
        throw new Error('setRTLTextPlugin cannot be called multiple times.');
    }
    pluginRequested = true;
    pluginURL = resolvePluginUrl(url);
    _completionCallback = (error?: Error) => {
        if (error) {
            // Clear loaded state to allow retries
            clearRTLTextPlugin();
            if (callback) {
                callback(error);
            }
        } else {
            // Called once for each worker
            foregroundLoadComplete = true;
        }
    };
    evented.fire(new Event('pluginAvailable', { pluginURL: pluginURL, completionCallback: _completionCallback }));
};

export const plugin: {
    applyArabicShaping: ?Function,
    processBidirectionalText: ?(string, Array<number>) => Array<string>,
    isLoaded: () => boolean
} = {
    applyArabicShaping: null,
    processBidirectionalText: null,
    isLoaded: function() {
        return foregroundLoadComplete ||       // Foreground: loaded if the completion callback returned successfully
            plugin.applyArabicShaping != null; // Background: loaded if the plugin functions have been compiled
    }
};
