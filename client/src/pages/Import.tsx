import { useState, useEffect, useRef } from 'react';
import { screenshots as scrApi, games as gamesApi, config as configApi } from '../api/client';
import { useImport } from '../contexts/ImportContext';
import { useAuth } from '../context/AuthContext';
import type { Game } from '../types';

export default function Import() {
  const [tab, setTab] = useState<'steam' | 'folder'>('folder');
  const [message, setMessage] = useState('');
  const [messageLeaving, setMessageLeaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!message) return;
    setMessageLeaving(false);
    const fadeTimer = window.setTimeout(() => setMessageLeaving(true), 9300);
    const clearTimer = window.setTimeout(() => setMessage(''), 10000);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [message]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 animate-fade-up">
      <h1 className="font-display text-2xl mb-5">导入截图</h1>

      <ContentDisclaimer />

      {/* Tab bar */}
      <div className="mb-8 flex gap-2 rounded-2xl border border-white/[0.10] bg-black/35 p-1 backdrop-blur-xl">
        <button
          onClick={() => setTab('folder')}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
            tab === 'folder'
              ? 'border border-cyan-100/85 bg-cyan-400/[0.55] text-white'
              : 'border border-white/[0.26] bg-white/[0.24] text-white/[0.96] hover:bg-white/[0.34] hover:text-white'
          }`}
        >
          文件夹上传
        </button>
        <button
          onClick={() => setTab('steam')}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
            tab === 'steam'
              ? 'border border-cyan-100/85 bg-cyan-400/[0.55] text-white'
              : 'border border-white/[0.26] bg-white/[0.24] text-white/[0.96] hover:bg-white/[0.34] hover:text-white'
          }`}
        >
          Steam ID 导入
        </button>
      </div>

      {message && (
        <div
          key={message}
          className={`overflow-hidden rounded-xl border bg-emerald-600/[0.72] px-4 text-sm font-semibold text-white shadow-lg shadow-emerald-950/35 backdrop-blur-xl transition-[max-height,margin,padding,opacity,transform,border-color] duration-700 ease-out ${
            messageLeaving
              ? 'mb-0 max-h-0 translate-y-1 border-transparent py-0 opacity-0'
              : 'mb-5 max-h-28 translate-y-0 border-emerald-200/55 py-4 opacity-100 animate-toast-in'
          }`}
        >
          {message}
        </div>
      )}

      {tab === 'folder' ? (
        <FolderUpload onMessage={setMessage} onLoading={setLoading} />
      ) : (
        <SteamApiImport />
      )}
    </div>
  );
}

function ContentDisclaimer() {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="mb-8 flex justify-end">
        <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/[0.20] bg-zinc-700/[0.72] px-3 py-2 text-xs text-white/82 shadow-lg shadow-black/30 backdrop-blur-2xl">
          <span className="h-2 w-2 shrink-0 rounded-full bg-red-400 shadow-[0_0_16px_rgba(248,113,113,0.9)]" />
          <span className="truncate font-medium">内容合规提示</span>
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="rounded-full border border-white/[0.20] bg-white/[0.12] px-2 py-0.5 text-white/88 transition-colors hover:bg-white/[0.20] hover:text-white"
            aria-expanded="false"
          >
            展开
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 rounded-2xl border border-white/[0.22] bg-zinc-700/[0.72] px-4 py-3.5 text-sm text-white/92 shadow-xl shadow-black/35 backdrop-blur-2xl">
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-200/45 bg-red-500/[0.30] text-red-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_28px_rgba(248,113,113,0.44)]">
        <svg className="h-4 w-4 drop-shadow-[0_0_8px_rgba(248,113,113,0.85)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        </svg>
        </div>
        <div className="min-w-0 flex-1 space-y-1 leading-relaxed">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold text-white">内容合规提示</p>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="shrink-0 rounded-full border border-white/[0.20] bg-white/[0.12] px-2.5 py-1 text-xs font-semibold text-white/88 transition-colors hover:bg-white/[0.20] hover:text-white"
              aria-expanded="true"
            >
              收起
            </button>
          </div>
          <p className="text-white/78">
            请勿上传、导入或公开展示任何违反我国法律法规、公序良俗，或侵犯他人合法权益的内容。您应对所上传内容的合法性与权利来源负责；平台有权对违规内容进行隐藏、删除或限制展示。
          </p>
        </div>
      </div>
    </div>
  );
}

function FolderUpload({ onMessage, onLoading }: { onMessage: (m: string) => void; onLoading: (l: boolean) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [gameName, setGameName] = useState('');
  const [gameSearch, setGameSearch] = useState('');
  const [gameResults, setGameResults] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [folderPath, setFolderPath] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (gameSearch.length > 0) {
      gamesApi.search(gameSearch).then((d) => setGameResults(d.games)).catch(() => {});
    } else {
      setGameResults([]);
    }
  }, [gameSearch]);

  function handleGameSearchFocus() {
    if (!gameSearch) {
      gamesApi.search('').then((d) => setGameResults(d.games)).catch(() => {});
    }
  }

  useEffect(() => {
    return () => { previews.forEach((url) => URL.revokeObjectURL(url)); };
  }, [previews]);

  function addFiles(selected: File[]) {
    if (selected.length === 0) return;
    const valid = selected.filter((f) => f.size <= 10 * 1024 * 1024);
    const tooBig = selected.length - valid.length;
    if (tooBig > 0) {
      onMessage(`${tooBig} 个文件超过 10MB 限制，已自动跳过`);
    }
    if (valid.length === 0) return;
    setFiles((prev) => [...prev, ...valid]);
    if ('webkitRelativePath' in valid[0] && (valid[0] as any).webkitRelativePath) {
      setFolderPath((valid[0] as any).webkitRelativePath);
    }
    const newPreviews = valid.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...newPreviews]);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files || []));
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    addFiles(dropped);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    URL.revokeObjectURL(previews[index]);
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function clearAll() {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setFiles([]);
    setPreviews([]);
    setFolderPath('');
    setGameName('');
    setSelectedGameId(null);
  }

  async function handleUpload() {
    if (files.length === 0) return;
    if (!selectedGameId && !gameName) {
      onMessage('请选择或输入游戏名称');
      return;
    }
    setUploading(true);
    onLoading(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      if (selectedGameId) formData.append('game_id', String(selectedGameId));
      if (gameName) formData.append('game_name', gameName);
      if (folderPath) formData.append('folder_path', folderPath);

      const result = await scrApi.importFolder(formData);
      onMessage(`成功导入 ${result.added} 张截图！`);
      clearAll();
    } catch (err: any) {
      onMessage(`导入失败：${err.message}`);
    } finally {
      setUploading(false);
      onLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Upload area */}
      <div
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-6 sm:p-10 text-center cursor-pointer transition-all duration-200 bg-black/30 hover:bg-black/45 ${
          dragOver
            ? 'border-cyan-100/85 bg-cyan-400/[0.42]'
            : 'border-border hover:border-white/[0.15]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-ignore
          webkitdirectory=""
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-4">
          <svg className="w-12 h-12 text-white/75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-white/85">拖拽图片到此处，或点击选择</p>
          <div className="flex gap-3 mt-1">
            <button
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              className="btn-download text-sm"
            >
              选择图片
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}
              className="btn-private text-sm"
            >
              选择文件夹
            </button>
          </div>
          <p className="text-xs text-white/75">支持 JPG、PNG、WebP、GIF，单张最大 10MB</p>
        </div>
      </div>

      {/* Previews */}
      {previews.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/85 font-medium">已选择 {files.length} 张</span>
            <button onClick={clearAll} className="btn-delete text-xs">
              清空全部
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-80 overflow-y-auto p-3 rounded-xl bg-black/35 border border-white/[0.10] backdrop-blur-xl">
            {previews.slice(0, 100).map((url, i) => (
              <div key={i} className="image-display-card image-hover-card group relative overflow-hidden rounded-lg">
                <div className="img-hover-zoom aspect-[16/10]">
                  <img src={url} alt={files[i]?.name || ''} className="w-full h-full object-cover" />
                </div>
                <div className="px-2 py-1.5">
                  <p className="text-[9px] text-white/75 truncate">{files[i]?.name}</p>
                </div>
                <button
                  onClick={() => removeFile(i)}
                  className="btn-icon-round btn-close-red absolute top-1 right-1 h-5 w-5 text-xs opacity-0 group-hover:opacity-100"
                >
                  &times;
                </button>
              </div>
            ))}
            {previews.length > 100 && (
              <div className="text-xs text-white/75 flex items-center justify-center">
                ...还有 {previews.length - 100} 张
              </div>
            )}
          </div>
        </>
      )}

      {/* Game assignment */}
      {files.length > 0 && (
        <div className="space-y-3 p-5 glass">
          <h3 className="text-sm font-medium text-text-primary">分配游戏名称</h3>
          <div>
            <input
              type="text"
              value={gameSearch}
              onChange={(e) => { setGameSearch(e.target.value); setSelectedGameId(null); setGameName(''); }}
              onFocus={handleGameSearchFocus}
              placeholder="搜索已有游戏...（点击展开全部）"
              className="input-field"
            />
            {gameResults.length > 0 && (
              <div className="mt-1.5 rounded-xl bg-black/25 border border-white/[0.08] backdrop-blur-md max-h-36 overflow-y-auto overflow-hidden">
                {gameResults.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => { setSelectedGameId(g.id); setGameName(g.name); setGameSearch(''); setGameResults([]); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/[0.16] transition-colors duration-150"
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <input
              type="text"
              value={gameName}
              onChange={(e) => { setGameName(e.target.value); setSelectedGameId(null); }}
              placeholder="或输入新游戏名称..."
              className="input-field"
            />
          </div>
        </div>
      )}

      {/* Upload button */}
      {files.length > 0 && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="btn-upload w-full py-3.5 text-base"
        >
          {uploading ? `上传中 (${files.length} 张)...` : `上传 ${files.length} 张截图`}
        </button>
      )}
    </div>
  );
}

function SteamApiImport() {
  const { state, startImport, cancelImport, retryFailed, clear } = useImport();
  const { user } = useAuth();
  const [steamInput, setSteamInput] = useState('');
  const [fadingOut, setFadingOut] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const active = state.phase !== 'idle' && state.phase !== 'done' && state.phase !== 'error';

  useEffect(() => {
    if (!user) { setSteamInput(''); return; }
    configApi.get().then((d) => {
      if (d.config?.steam_id) setSteamInput(d.config.steam_id);
      else setSteamInput('');
    }).catch(() => {});
  }, [user]);

  const total = state.total_discovered || 0;
  const resolved = state.total_resolved || state.live_resolved || 0;
  const failed = state.total_failed || state.live_failed || 0;
  const downloadFailed = state.live_download_failed || 0;
  const downloaded = state.total_downloaded || state.live_downloaded || 0;
  const staleFailed = state.stale_failed || 0;
  const stalePending = state.stale_pending || 0;
  const staleTotal = staleFailed + stalePending;

  // Auto-dismiss progress card 10s after a clean completion (no remaining failures)
  useEffect(() => {
    if (state.phase === 'done' && staleTotal === 0) {
      setFadingOut(false);
      const fadeTimer = setTimeout(() => setFadingOut(true), 10000);
      const clearTimer = setTimeout(() => clear(), 10500); // after animation
      return () => { clearTimeout(fadeTimer); clearTimeout(clearTimer); };
    } else {
      setFadingOut(false);
    }
  }, [state.phase, staleTotal, clear]);

  function doImport() {
    if (!steamInput.trim() || active) return;
    startImport(steamInput.trim());
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm text-white mb-2 font-semibold">
          Steam 个人资料链接
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={steamInput}
            onChange={(e) => setSteamInput(e.target.value)}
            placeholder="https://steamcommunity.com/profiles/7656119XXXXXXXXXX 或 /id/用户名"
            className="input-field flex-1"
            disabled={active}
          />
          <div className="flex gap-2 sm:shrink-0">
            {active ? (
              <button
                onClick={cancelImport}
                className="btn-delete text-sm whitespace-nowrap w-full sm:w-auto"
              >
                终止导入
              </button>
            ) : state.phase === 'done' || state.phase === 'error' ? (
              <button
                onClick={clear}
                className="btn-secondary text-sm whitespace-nowrap w-full sm:w-auto"
              >
                重新导入
              </button>
            ) : (
              <button
                onClick={doImport}
                disabled={!steamInput.trim()}
                className="btn-upload text-sm whitespace-nowrap w-full sm:w-auto"
              >
                开始导入
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-white/85 mt-2">
          支持 /profiles/、/id/ 链接或 17 位 Steam ID。请确保截图权限为「公开」——导入在后台运行，可自由切换页面
        </p>
      </div>

      {/* Stale items retry — visible when not actively importing */}
      {!active && staleTotal > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200/45 bg-amber-700/[0.72] p-4 shadow-lg shadow-black/30 backdrop-blur-xl">
          <div>
            <p className="text-sm text-amber-50 font-semibold">
              {staleFailed > 0 && stalePending > 0
                ? `有 ${staleFailed} 张限速失败、${stalePending} 张待解析`
                : staleFailed > 0
                  ? `上次导入有 ${staleFailed} 张截图因限速失败`
                  : `有 ${stalePending} 张截图尚未完成解析`}
            </p>
            <p className="text-xs text-white/80 mt-0.5">不会重复下载已成功的截图</p>
          </div>
          <button
            onClick={retryFailed}
            className="min-h-10 shrink-0 rounded-xl border border-amber-100/55 bg-amber-300/[0.26] px-4 text-sm font-semibold text-amber-50 shadow-lg shadow-amber-950/20 backdrop-blur-xl transition-all duration-200 hover:border-amber-50/80 hover:bg-amber-200/[0.34] hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
          >
            继续处理 {staleTotal} 张
          </button>
        </div>
      )}

      {/* Progress bar */}
      {state.phase !== 'idle' && (
        <div className={`p-5 rounded-2xl bg-black/55 border border-white/[0.15] backdrop-blur-xl space-y-4 transition-all duration-500 ease-out ${
          fadingOut ? 'opacity-0 translate-y-2 pointer-events-none' : 'opacity-100'
        }`}>
          {/* Phase indicators */}
          <div className="flex items-center gap-3 text-sm">
            <PhaseBadge label="发现" done={state.phase !== 'discover'} active={state.phase === 'discover'} />
            <span className="text-white/75">→</span>
            <PhaseBadge label="解析" done={state.phase === 'download' || state.phase === 'done'} active={state.phase === 'resolve'} />
            <span className="text-white/75">→</span>
            <PhaseBadge label="下载" done={state.phase === 'done'} active={state.phase === 'download'} />

            {/* Help tooltip */}
            <div className="relative ml-auto">
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="btn-icon-round h-5 w-5 text-[11px] font-semibold"
                title="了解导入流程"
              >
                ?
              </button>
              {showHelp && (
                <>
                  <div className="fixed inset-0 z-[8990] bg-black/30 backdrop-blur-sm" onClick={() => setShowHelp(false)} />
                  <div className="fixed right-4 left-4 sm:absolute sm:right-0 sm:left-auto sm:top-7 top-20 z-[9000] sm:w-72 p-4 rounded-xl
                                  bg-black/90 border border-white/[0.18] backdrop-blur-xl
                                  shadow-xl shadow-black/50 text-xs text-white/85 leading-relaxed
                                  animate-fade-up">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-white text-sm">导入流程说明</span>
                      <button
                        onClick={() => setShowHelp(false)}
                        className="btn-icon btn-close-red h-7 w-7 rounded-lg"
                      >
                        ✕
                      </button>
                    </div>
                    <ol className="space-y-1.5 list-decimal list-inside">
                      <li><span className="text-cyan-100 font-medium">发现</span> — 翻页抓取 Steam 截图列表，获取所有文件 ID</li>
                      <li><span className="text-cyan-100 font-medium">解析</span> — 逐个请求每个截图的详情页，提取原始图片地址</li>
                      <li><span className="text-cyan-100 font-medium">下载</span> — 将图片下载到本地服务器并生成缩略图</li>
                    </ol>
                    <div className="mt-2.5 pt-2.5 border-t border-white/[0.10] text-white/70 space-y-1">
                      <p>为防止 Steam 限速（429），每解析 40 张后会暂停 <span className="text-amber-400">3 分钟</span>。</p>
                      <p>受 Steam 限制影响，部分图片解析失败（标记为"限速失败"）是正常现象，等待几分钟后点击<span className="text-amber-400 font-medium">「继续处理」</span>重试即可，已成功的不会重复下载。</p>
                      <p>整个过程可能耗时较长，您可以<span className="text-emerald-400 font-medium">离开当前页面</span>，导入会在后台自动运行。</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Progress details */}
          {state.phase === 'discover' && (
            <>
              {total > 0 ? (
                <ProgressRow
                  label="翻页发现截图"
                  value={state.live_pending}
                  max={total}
                  hint={`${state.live_pending}/${total}`}
                />
              ) : (
                <p className="text-sm text-white/75 animate-pulse">
                  正在翻页发现截图{state.live_pending > 0 ? `（已发现 ${state.live_pending} 张）` : '...'}
                </p>
              )}
            </>
          )}

          {(state.phase === 'resolve' || state.phase === 'download' || state.phase === 'done') && total > 0 && (
            <div className="space-y-3">
              <ProgressRow
                label="解析 og:image"
                value={resolved}
                max={total}
                hint={`${resolved}/${total}`}
                sub={`${failed} 张限速失败`}
              />
              {state.phase !== 'resolve' && (
                <ProgressRow
                  label="下载图片"
                  value={downloaded}
                  max={total - failed - downloadFailed}
                  hint={`${downloaded}/${total - failed - downloadFailed}`}
                  sub={downloadFailed > 0 ? `${downloadFailed} 张下载失败` : undefined}
                />
              )}
            </div>
          )}

          {state.phase === 'done' && (
            <div className="text-sm text-emerald-400 font-medium">
              导入完成！新增 {downloaded} 张
              {failed > 0 && (
                <span className="text-amber-400 ml-2">
                  ，{failed} 张因限速失败（可稍后重试）
                </span>
              )}
            </div>
          )}

          {state.phase === 'error' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-red-300/30 bg-red-500/[0.10] px-4 py-3 text-sm text-red-200">
                {state.error_msg || '导入失败'}
              </div>
              <div className="flex justify-end">
                <button onClick={clear} className="btn-delete min-h-9 px-4 py-1.5 text-xs">
                  关闭
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

function PhaseBadge({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  let cls = 'px-2 py-0.5 rounded-full text-xs font-medium ';
  if (done) cls += 'bg-emerald-500/30 text-emerald-300';
  else if (active) cls += 'bg-cyan-400/[0.55] text-white border border-cyan-100/85 shadow-[0_0_12px] shadow-cyan-400/30 animate-pulse';
  else cls += 'bg-black/25 border border-white/[0.10] backdrop-blur-xl text-white/75';
  return <span className={cls}>{label}</span>;
}

function ProgressRow({ label, value, max, hint, sub }: { label: string; value: number; max: number; hint: string; sub?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-white/85">{label}</span>
        <span className="text-white/75 font-mono">{hint}</span>
      </div>
      <div className="w-full h-2 rounded-full bg-white/15 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      {sub && <p className="text-xs text-white/75 mt-0.5">{sub}</p>}
    </div>
  );
}
