import { Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ErrorNoticeDirective } from '../../shared/error-notice/error-notice';
import { AppIcon } from '../../shared/icons/app-icon';
import { AppSelect, SelectOption } from '../../shared/form/select';
import { Modal } from '../../shared/modal/modal';
import { FileCategory, FileStorage, OrganisationApi, PersonalFile } from './organisation-api.service';
import { FILE_CATEGORIES, agoText, editedAt, fileCategory, fileKind, fileSize } from './organisation-logic';

type View = 'all' | 'recent' | 'favorites' | FileCategory;
const RECENT_DAYS = 7;
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.docx,.xlsx';

/**
 * Dateien nach Entwurf: links Hochladen, Ansichten und Kategorien mit
 * Speicherplatz, in der Mitte die Liste, rechts Vorschau und Informationen.
 * Inhalte kommen nur über die angemeldete API (OrganisationApi.fileContent)
 * als Blob — es gibt keine öffentliche Datei-URL. Der Server prüft Typ,
 * Größe und Eigentum (backend organisation/files.py).
 */
@Component({
  selector: 'app-org-files',
  standalone: true,
  imports: [AppIcon, AppSelect, Modal, ErrorNoticeDirective],
  templateUrl: './org-files.html',
  styleUrls: ['./org-common.scss', './org-files.scss'],
})
export class OrgFiles {
  private readonly api = inject(OrganisationApi);
  private readonly destroy = inject(DestroyRef);
  /** Steigt bei „Datei hochladen“ im Seitenkopf. */
  readonly uploadRequest = input(0);

  private readonly picker = viewChild.required<ElementRef<HTMLInputElement>>('picker');
  protected readonly accept = ACCEPT;
  protected readonly files = signal<PersonalFile[] | null>(null);
  protected readonly storage = signal<FileStorage | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly view = signal<View>('recent');
  protected readonly query = signal('');
  protected readonly selectedId = signal<number | null>(null);
  protected readonly sheetOpen = signal(false);
  protected readonly confirmDelete = signal(false);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly categories = FILE_CATEGORIES;
  protected readonly categoryOptions: SelectOption[] = FILE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }));

  protected readonly fileKind = fileKind;
  protected readonly fileSize = fileSize;
  protected readonly agoText = agoText;
  protected readonly editedAt = editedAt;
  protected readonly fileCategory = fileCategory;

  private readonly recentCutoff = Date.now() - RECENT_DAYS * 86_400_000;
  protected readonly counts = computed(() => {
    const list = this.files() ?? [];
    const byCategory = new Map<FileCategory, number>();
    for (const f of list) byCategory.set(f.category, (byCategory.get(f.category) ?? 0) + 1);
    return {
      all: list.length,
      recent: list.filter((f) => new Date(f.used_at).getTime() >= this.recentCutoff).length,
      favorites: list.filter((f) => f.favorite).length,
      byCategory,
    };
  });
  protected readonly viewLabel = computed(() => {
    const v = this.view();
    if (v === 'all') return 'Alle Dateien';
    if (v === 'recent') return 'Zuletzt verwendet';
    if (v === 'favorites') return 'Favoriten';
    return fileCategory(v).label;
  });
  protected readonly visible = computed(() => {
    const v = this.view();
    const q = this.query().trim().toLocaleLowerCase('de');
    return (this.files() ?? []).filter((f) => {
      if (q && !f.name.toLocaleLowerCase('de').includes(q)) return false;
      if (v === 'recent') return new Date(f.used_at).getTime() >= this.recentCutoff;
      if (v === 'favorites') return f.favorite;
      if (v !== 'all') return f.category === v;
      return true;
    });
  });
  protected readonly selected = computed(() => {
    const list = this.visible();
    return list.find((f) => f.id === this.selectedId()) ?? list[0] ?? null;
  });
  protected readonly storageShare = computed(() => {
    const s = this.storage();
    return s && s.quota ? Math.min(100, (s.used / s.quota) * 100) : 0;
  });

  constructor() {
    this.load();
    effect(() => {
      if (this.uploadRequest() > 0) untracked(() => this.pick());
    });
    // Vorschau für Bilder laden, sobald sich die Auswahl ändert.
    effect(() => {
      const file = this.selected();
      untracked(() => this.loadPreview(file));
    });
    this.destroy.onDestroy(() => this.revoke());
  }

  load(): void {
    this.api.files().pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (list) => {
        this.files.set(list);
        this.error.set('');
      },
      error: () => this.error.set('Deine Dateien konnten nicht geladen werden. Bitte versuche es erneut.'),
    });
    this.api.fileStorage().pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (s) => this.storage.set(s),
      error: () => this.storage.set(null),
    });
  }

  protected setView(view: View): void {
    this.view.set(view);
    this.selectedId.set(null);
  }

  protected select(file: PersonalFile): void {
    this.selectedId.set(file.id);
    this.sheetOpen.set(true);
    this.confirmDelete.set(false);
  }

  protected pick(): void {
    this.picker().nativeElement.click();
  }

  protected onPicked(input: HTMLInputElement): void {
    const chosen = Array.from(input.files ?? []);
    input.value = '';
    if (!chosen.length) return;
    const v = this.view();
    const category = v === 'all' || v === 'recent' || v === 'favorites' ? null : v;
    this.uploadNext(chosen, category, 0);
  }

  private uploadNext(queue: File[], category: FileCategory | null, done: number): void {
    const file = queue.shift();
    if (!file) {
      this.busy.set(false);
      this.load();
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.error.set(`„${file.name}“ ist größer als 10 MB.`);
      return this.uploadNext(queue, category, done);
    }
    this.busy.set(true);
    this.api.uploadFile(file, category).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (created) => {
        this.selectedId.set(created.id);
        this.uploadNext(queue, category, done + 1);
      },
      error: (e: unknown) => {
        this.error.set(this.apiMessage(e) ?? `„${file.name}“ konnte nicht hochgeladen werden.`);
        this.uploadNext(queue, category, done);
      },
    });
  }

  private apiMessage(e: unknown): string | null {
    if (!(e instanceof HttpErrorResponse) && !(e && typeof e === 'object' && 'error' in e)) return null;
    const body = (e as { error?: Record<string, unknown> }).error;
    if (!body || typeof body !== 'object') return null;
    for (const value of Object.values(body)) {
      const first = Array.isArray(value) ? value[0] : value;
      if (typeof first === 'string') return first;
    }
    return null;
  }

  protected toggleFavorite(file: PersonalFile): void {
    this.patch(file, { favorite: !file.favorite });
  }

  protected setCategory(file: PersonalFile, value: string): void {
    this.patch(file, { category: value as FileCategory });
  }

  private patch(file: PersonalFile, data: Partial<Pick<PersonalFile, 'favorite' | 'category'>>): void {
    this.files.update((list) => (list ?? []).map((f) => (f.id === file.id ? { ...f, ...data } : f)));
    this.api.updateFile(file.id, data).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      error: () => {
        this.files.update((list) => (list ?? []).map((f) => (f.id === file.id ? file : f)));
        this.error.set('Die Änderung konnte nicht gespeichert werden.');
      },
    });
  }

  protected remove(file: PersonalFile): void {
    this.api.removeFile(file.id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => {
        this.confirmDelete.set(false);
        this.sheetOpen.set(false);
        this.selectedId.set(null);
        this.load();
      },
      error: () => this.error.set('Die Datei konnte nicht gelöscht werden.'),
    });
  }

  /** Öffnet die Datei in einem neuen Tab (nur Bilder und PDFs zeigt der Browser selbst), sonst Download. */
  protected openFile(file: PersonalFile): void {
    const showable = file.content_type === 'application/pdf' || file.content_type.startsWith('image/');
    this.api.fileContent(file.id, !showable).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        if (showable) window.open(url, '_blank', 'noopener');
        else this.saveBlob(url, file.name);
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => this.error.set('Die Datei konnte nicht geöffnet werden.'),
    });
  }

  protected download(file: PersonalFile): void {
    this.api.fileContent(file.id, true).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        this.saveBlob(url, file.name);
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => this.error.set('Die Datei konnte nicht heruntergeladen werden.'),
    });
  }

  private saveBlob(url: string, name: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.rel = 'noopener';
    link.click();
  }

  private loadPreview(file: PersonalFile | null): void {
    this.revoke();
    if (!file || !fileKind(file).image) return;
    this.api.fileContent(file.id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (blob) => {
        if (this.selected()?.id === file.id) this.previewUrl.set(URL.createObjectURL(blob));
      },
      error: () => this.previewUrl.set(null),
    });
  }

  private revoke(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewUrl.set(null);
  }

  /** Name ohne Endung für die Dokument-Vorschau. */
  protected baseName(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(0, dot) : name;
  }

  protected categoryCount(value: FileCategory): number {
    return this.counts().byCategory.get(value) ?? 0;
  }
}
