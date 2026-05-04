// @def.boundary motion-content-editor-system
export interface MotionEditorPrefsStore {
  read(key: string): string | null;
  write(key: string, value: string): boolean;
  remove(key: string): void;
}

export const MOTION_EDITOR_THEME_STORAGE_KEY = "mce-theme/v1";
export const MOTION_EDITOR_LAYOUT_STORAGE_KEY = "mce-layout/v1";

type MotionEditorPrefsStorageSource = Storage | null | (() => Storage | null);

function resolveMotionEditorPrefsStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function createMotionEditorPrefsStore(
  storageSource: MotionEditorPrefsStorageSource = resolveMotionEditorPrefsStorage,
): MotionEditorPrefsStore {
  const getStorage = (): Storage | null => {
    try {
      return typeof storageSource === "function"
        ? storageSource()
        : storageSource;
    } catch {
      return null;
    }
  };

  return {
    read(key) {
      const storage = getStorage();
      if (!storage) {
        return null;
      }

      try {
        return storage.getItem(key);
      } catch {
        return null;
      }
    },
    write(key, value) {
      const storage = getStorage();
      if (!storage) {
        return false;
      }

      try {
        storage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      const storage = getStorage();
      if (!storage) {
        return;
      }

      try {
        storage.removeItem(key);
      } catch {
        // noop
      }
    },
  };
}

export const motionEditorPrefsStore = createMotionEditorPrefsStore();

export function readMotionEditorPref(
  key: string,
  store: MotionEditorPrefsStore = motionEditorPrefsStore,
): string | null {
  return store.read(key);
}

export function writeMotionEditorPref(
  key: string,
  value: string,
  store: MotionEditorPrefsStore = motionEditorPrefsStore,
): boolean {
  return store.write(key, value);
}

export function clearMotionEditorPref(
  key: string,
  store: MotionEditorPrefsStore = motionEditorPrefsStore,
): void {
  store.remove(key);
}
