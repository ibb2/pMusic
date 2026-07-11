import type { DownloadsApi } from "./types";

export const downloadsApi: DownloadsApi = {
  async start(target) {
    await window.api.downloads.create(target.type, target.ratingKey);
  },
  async list() {
    const [items, storage] = await Promise.all([
      window.api.downloads.list(),
      window.api.downloads.getStorageStatus(),
    ]);
    return {
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: [item.artist, item.album].filter(Boolean).join(" · "),
        targetType: item.targetType,
        status: item.state,
        bytesDownloaded: item.bytesDownloaded,
        bytesTotal: item.bytesTotal ?? undefined,
        error: item.error ?? undefined,
      })),
      storage: { bytesUsed: storage.usedBytes },
    };
  },
  async retry(id) {
    await window.api.downloads.retry(id);
  },
  async remove(id) {
    await window.api.downloads.remove(id);
  },
};
