function tokenParam() {
  const token = localStorage.getItem('token');
  return token ? `?token=${encodeURIComponent(token)}` : '';
}

export function screenshotUrl(id: number) {
  return `/api/screenshots/${id}/file${tokenParam()}`;
}

export function thumbnailUrl(id: number) {
  return `/api/screenshots/${id}/thumbnail${tokenParam()}`;
}
