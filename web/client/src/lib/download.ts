/**
 * Hand a Blob to the browser as a file download.
 *
 * The anchor is appended to the document because Firefox ignores `click()` on a
 * detached node, and the object URL is released immediately afterwards so a long
 * session of exports cannot pile up blobs.
 */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
