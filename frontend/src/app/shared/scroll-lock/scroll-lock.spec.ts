import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { Modal } from '../modal/modal';
import { lockScroll, resetScrollLock, unlockScroll } from './scroll-lock';

const htmlOverflow = () => document.documentElement.style.overflow;

describe('scroll lock', () => {
  afterEach(() => resetScrollLock());

  it('locks the html element (the real scroll container) and counts nested locks', () => {
    lockScroll();
    expect(htmlOverflow()).toBe('hidden');
    expect(document.body.style.overflow).toBe('hidden');
    lockScroll(); // z. B. „Wirklich löschen?“ über einem Formular
    unlockScroll();
    expect(htmlOverflow()).toBe('hidden');
    unlockScroll();
    expect(htmlOverflow()).toBe('');
    expect(document.body.style.overflow).toBe('');
    unlockScroll(); // zusätzliches Freigeben schadet nicht
    expect(htmlOverflow()).toBe('');
  });

  @Component({
    imports: [Modal],
    template: `
      <app-modal [open]="first()" labelledBy="a" (closed)="first.set(false)"><h2 id="a">A</h2><button>ok</button></app-modal>
      <app-modal [open]="second()" labelledBy="b" (closed)="second.set(false)"><h2 id="b">B</h2><button>ok</button></app-modal>
    `,
  })
  class Host {
    readonly first = signal(false);
    readonly second = signal(false);
  }

  it('a closed modal on the same page never releases the lock of an open one', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    expect(htmlOverflow()).toBe('');
    fixture.componentInstance.first.set(true);
    fixture.detectChanges();
    expect(htmlOverflow()).toBe('hidden');
    // ein zweiter Dialog öffnet und schließt — der erste ist noch offen
    fixture.componentInstance.second.set(true);
    fixture.detectChanges();
    fixture.componentInstance.second.set(false);
    fixture.detectChanges();
    expect(htmlOverflow()).toBe('hidden');
    fixture.componentInstance.first.set(false);
    fixture.detectChanges();
    expect(htmlOverflow()).toBe('');
  });

  it('destroying an open modal releases its lock', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.first.set(true);
    fixture.detectChanges();
    expect(htmlOverflow()).toBe('hidden');
    fixture.destroy();
    expect(htmlOverflow()).toBe('');
  });
});
