import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { NavigationError } from '@angular/router';
import { ChunkLoadRecovery, isChunkLoadError } from './chunk-load-recovery';

describe('isChunkLoadError', () => {
  it('erkennt die Meldungen von Chrome, Firefox, Safari und Webpack', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/chunk-A.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: https://x/chunk-A.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(Object.assign(new Error('Loading chunk 42 failed.'), { name: 'ChunkLoadError' }))).toBe(true);
  });

  it('lässt andere Fehler in Ruhe', () => {
    expect(isChunkLoadError(new Error('Cannot match any routes'))).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe('ChunkLoadRecovery', () => {
  let assign: ReturnType<typeof vi.fn>;
  let storage: Map<string, string>;
  let recovery: ChunkLoadRecovery;
  let listeners: Map<string, () => void>;

  const chunkError = (url = '/demo/finanzen') =>
    new NavigationError(1, url, new TypeError('Failed to fetch dynamically imported module: /chunk-X.js'));

  beforeEach(() => {
    assign = vi.fn();
    storage = new Map();
    listeners = new Map();
    const fakeWindow = {
      location: { assign },
      addEventListener: (type: string, fn: () => void) => listeners.set(type, fn),
      sessionStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) },
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: DOCUMENT, useValue: { defaultView: fakeWindow } },
        { provide: Location, useValue: { prepareExternalUrl: (url: string) => '/4inOne' + url } },
      ],
    });
    recovery = TestBed.inject(ChunkLoadRecovery);
  });

  it('lädt die Zielseite beim ersten Fehler einmal neu – mit Basis-Pfad, nicht die Startseite', () => {
    recovery.handle(chunkError());
    expect(assign).toHaveBeenCalledWith('/4inOne/demo/finanzen');
    expect(recovery.failedUrl()).toBeNull();
  });

  it('kapert das Verlassen der Seite nicht: Abbruch beim Wegnavigieren ist kein Funkloch (Safari)', () => {
    listeners.get('beforeunload')?.();
    recovery.handle(chunkError());
    expect(assign).not.toHaveBeenCalled();
    expect(recovery.failedUrl()).toBeNull();
    // aus dem Seiten-Cache zurück: wieder normal
    listeners.get('pageshow')?.();
    recovery.handle(chunkError());
    expect(assign).toHaveBeenCalledWith('/4inOne/demo/finanzen');
  });

  it('zeigt beim zweiten Fehler kurz danach den Hinweis statt einer Neulade-Schleife', () => {
    recovery.handle(chunkError());
    recovery.handle(chunkError());
    expect(assign).toHaveBeenCalledTimes(1);
    expect(recovery.failedUrl()).toBe('/4inOne/demo/finanzen');

    recovery.reload();
    expect(assign).toHaveBeenLastCalledWith('/4inOne/demo/finanzen');
    recovery.dismiss();
    expect(recovery.failedUrl()).toBeNull();
  });

  it('ignoriert Navigationsfehler, die nichts mit dem Nachladen zu tun haben', () => {
    recovery.handle(new NavigationError(1, '/x', new Error('Cannot match any routes')));
    expect(assign).not.toHaveBeenCalled();
    expect(recovery.failedUrl()).toBeNull();
  });

  it('ohne Sitzungsspeicher (privates Fenster) direkt den Hinweis zeigen', () => {
    const blocked = { location: { assign }, sessionStorage: { getItem: () => { throw new Error('denied'); }, setItem: () => undefined } };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: DOCUMENT, useValue: { defaultView: blocked } },
        { provide: Location, useValue: { prepareExternalUrl: (url: string) => url } },
      ],
    });
    const r = TestBed.inject(ChunkLoadRecovery);
    r.handle(chunkError('/haushalt'));
    expect(assign).not.toHaveBeenCalled();
    expect(r.failedUrl()).toBe('/haushalt');
  });
});
