const MAX_EVIDENCE_BYTES = 3 * 1024 * 1024;
const SAFE_DATA_URL_BYTES = 2.55 * 1024 * 1024;

export async function prepareEvidenceFile(file) {
  if (!file) throw new Error('증빙 스크린샷을 첨부하세요.');
  if (!String(file.type || '').startsWith('image/')) {
    throw new Error('증빙은 이미지 파일만 첨부할 수 있습니다.');
  }
  if (file.size > MAX_EVIDENCE_BYTES) {
    throw new Error('증빙 이미지는 3MB 이하로 첨부하세요.');
  }

  let prepared = file;
  if (file.size > SAFE_DATA_URL_BYTES) {
    prepared = await compressImage(file);
  }

  const dataUrl = await fileToDataUrl(prepared);
  return {
    name: safeFileName(prepared.name || file.name || 'fund-evidence.jpg'),
    type: prepared.type || file.type || 'image/jpeg',
    size: prepared.size,
    dataUrl,
  };
}

export function evidenceFromClipboard(event) {
  const items = [...(event.clipboardData?.items ?? [])];
  const image = items.find((item) => String(item.type || '').startsWith('image/'));
  return image?.getAsFile?.() ?? null;
}

export function evidenceFromDrop(event) {
  const files = [...(event.dataTransfer?.files ?? [])];
  return files.find((file) => String(file.type || '').startsWith('image/')) ?? null;
}

async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  const maxSide = 2200;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  for (const quality of [0.9, 0.82, 0.74]) {
    const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (blob.size <= SAFE_DATA_URL_BYTES) {
      return new File([blob], replaceExtension(file.name, 'jpg'), { type: 'image/jpeg' });
    }
  }

  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.68);
  if (blob.size > MAX_EVIDENCE_BYTES) {
    throw new Error('이미지를 자동 최적화했지만 3MB를 초과합니다. 더 작은 스크린샷을 사용하세요.');
  }
  return new File([blob], replaceExtension(file.name, 'jpg'), { type: 'image/jpeg' });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('증빙 이미지를 처리할 수 없습니다.')), type, quality);
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('증빙 이미지를 읽을 수 없습니다.'));
    reader.readAsDataURL(file);
  });
}

function safeFileName(value) {
  return String(value || 'fund-evidence.jpg').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
}

function replaceExtension(name, ext) {
  const base = String(name || 'fund-evidence').replace(/\.[^.]+$/, '');
  return `${base}.${ext}`;
}
