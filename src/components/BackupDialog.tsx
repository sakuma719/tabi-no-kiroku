import { useRef, useState } from 'react';
import { Download, FileJson, Upload, TriangleAlert } from 'lucide-react';
import { createBackup, MAX_BACKUP_BYTES, parseBackup, restoreBackup } from '../lib/backup';
import { readData } from '../lib/db';
import { localToday } from '../lib/dates';
import { Dialog, ErrorMessage } from './Dialog';
import type { AppData } from '../lib/models';

export function BackupDialog({
  onClose,
  onRestored,
}: {
  onClose: () => void;
  onRestored: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ json: string; data: AppData; name: string } | null>(
    null,
  );
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    setError('');
    try {
      const json = createBackup(await readData());
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `tabi-no-kiroku-${localToday()}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setStatus(
        'バックアップをダウンロードしました。「ファイル」などに保存されたことを確認してください。',
      );
    } catch {
      setError('バックアップを作成できませんでした');
    } finally {
      setBusy(false);
    }
  }
  async function select(file?: File) {
    if (!file) return;
    setPending(null);
    setError('');
    setStatus('');
    setBusy(true);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('バックアップは10MB以内にしてください');
      const json = await file.text();
      setPending({ json, data: parseBackup(json), name: file.name });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'ファイルを読み取れません');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  async function restore() {
    if (
      !pending ||
      !window.confirm(
        '現在のすべての旅行・予定・スポットを、このバックアップで置き換えます。よろしいですか？',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await restoreBackup(pending.json);
      setPending(null);
      setStatus('バックアップを復元しました。');
      onRestored();
    } catch {
      setError(
        '復元できませんでした。元のデータは変更されていません。空き容量などを確認してください。',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="バックアップ・復元"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="dialog-body form-stack backup-body">
        <div className="backup-icon">
          <FileJson size={30} strokeWidth={1.4} />
        </div>
        <p>大切な旅の予定を、手元に残しましょう。</p>
        <p className="muted">
          データはこの端末・このブラウザだけに保存されます。定期的にJSONファイルを書き出してください。
        </p>
        <section className="backup-section">
          <h3>バックアップを書き出す</h3>
          <p className="field-hint">
            すべての旅行・予定・スポットを1つのファイルに保存します。メモや予約番号も含まれるため、保管・共有先にご注意ください。
          </p>
          <button className="button primary full-width" onClick={download} disabled={busy}>
            <Download size={18} />
            JSONをダウンロード
          </button>
        </section>
        <section className="backup-section">
          <h3>バックアップから復元する</h3>
          <p className="field-hint">
            形式を検証してから、現在のデータをすべて置き換えます。復元前のバックアップをおすすめします。
          </p>
          <input
            className="visually-hidden"
            aria-label="復元するJSONファイル"
            type="file"
            accept=".json,application/json"
            ref={input}
            onChange={(e) => void select(e.target.files?.[0])}
            disabled={busy}
          />
          <button
            className="button secondary full-width"
            onClick={() => input.current?.click()}
            disabled={busy}
          >
            <Upload size={18} />
            JSONファイルを選ぶ
          </button>
        </section>
        {pending && (
          <div className="restore-preview">
            <p>
              <strong>{pending.name}</strong>
            </p>
            <p>
              旅行 {pending.data.trips.length}件 · 予定 {pending.data.schedules.length}件 · スポット{' '}
              {pending.data.spots.length}件
            </p>
            <p className="warning">
              <TriangleAlert size={17} /> 現在のデータは置き換えられます。
            </p>
            <button className="button danger full-width" onClick={restore} disabled={busy}>
              このバックアップで置き換える
            </button>
          </div>
        )}
        {status && (
          <p className="success-message" role="status">
            {status}
          </p>
        )}
        <ErrorMessage message={error} />
      </div>
    </Dialog>
  );
}
