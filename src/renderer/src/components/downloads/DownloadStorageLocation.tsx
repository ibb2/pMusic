import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export function DownloadStorageLocation() {
  const client = useQueryClient();
  const storage = useQuery({
    queryKey: ["download-storage"],
    queryFn: () => window.api.downloads.getStorageStatus(),
  });
  const [directory, setDirectory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (storage.data?.storageDirectory)
      setDirectory(storage.data.storageDirectory);
  }, [storage.data?.storageDirectory]);
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await window.api.downloads.setStorageDirectory(directory);
      await client.invalidateQueries({ queryKey: ["download-storage"] });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not move downloads.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-2">
      <label htmlFor="download-directory" className="text-sm font-medium">
        Download location
      </label>
      <div className="flex gap-2">
        <Input
          id="download-directory"
          value={directory}
          onChange={(event) => setDirectory(event.target.value)}
        />
        <Button
          variant="outline"
          disabled={
            saving ||
            !directory.trim() ||
            directory === storage.data?.storageDirectory
          }
          onClick={() => void save()}
        >
          {saving ? "Moving…" : "Change"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Existing downloads are moved safely to the new location.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
