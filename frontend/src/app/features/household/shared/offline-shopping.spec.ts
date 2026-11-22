import { of, throwError } from 'rxjs';
import { OFFLINE_QUEUE_KEY, OFFLINE_SNAPSHOT_KEY, clearOfflineData } from '../../../core/offline/offline-keys';
import { ShoppingItemDto, ShoppingListDto, ShoppingOverviewDto } from '../data/household-api.service';
import { OfflineShopping } from './offline-shopping';

const list = (id: number) => ({ id, name: `Liste ${id}` }) as unknown as ShoppingListDto;
const item = (id: number, checked = false) => ({ id, shopping_list: 1, name: `Artikel ${id}`, is_checked: checked }) as unknown as ShoppingItemDto;
const overview = (items: ShoppingItemDto[]) => ({ list: list(1), items }) as unknown as ShoppingOverviewDto;

describe('Offline-Einkaufsliste', () => {
  beforeEach(() => localStorage.clear());

  it('zeigt nur den Stand der eigenen Person und vergisst gelöschte Listen', () => {
    const store = new OfflineShopping();
    store.save('lena@example.test', [list(1)], overview([item(1)]));
    expect(store.snapshot('lena@example.test')?.overviews['1'].items.length).toBe(1);
    expect(store.snapshot('max@example.test')).toBeNull();
    store.save('lena@example.test', [list(2)], { ...overview([]), list: list(2) });
    expect(Object.keys(store.snapshot()!.overviews)).toEqual(['2']);
  });

  it('merkt Abhaken (das Letzte gewinnt) und überträgt es der Reihe nach', async () => {
    const store = new OfflineShopping();
    store.save('lena@example.test', [list(1)], overview([item(1), item(2)]));
    store.queue(item(1), true);
    store.queue(item(1), false);
    store.queue(item(2), true);
    expect(store.pending()).toEqual([{ id: 1, is_checked: false }, { id: 2, is_checked: true }]);
    expect(store.snapshot()!.overviews['1'].items.find((i) => i.id === 2)!.is_checked).toBe(true);

    const sent: unknown[] = [];
    const count = await new Promise<number>((resolve) => store.flush((c) => (sent.push(c), of(c))).subscribe(resolve));
    expect(count).toBe(2);
    expect(sent.length).toBe(2);
    expect(store.pending()).toEqual([]);
  });

  it('behält den Rest bei einem Netzfehler und verwirft Artikel, die es nicht mehr gibt', async () => {
    const store = new OfflineShopping();
    store.queue(item(1), true);
    store.queue(item(2), true);
    store.queue(item(3), true);
    const send = (c: { id: unknown }) => (c.id === 1 ? throwError(() => ({ status: 404 })) : c.id === 2 ? of(c) : throwError(() => ({ status: 0 })));
    const count = await new Promise<number>((resolve) => store.flush(send).subscribe(resolve));
    expect(count).toBe(1);
    expect(store.pending()).toEqual([{ id: 3, is_checked: true }]);
  });

  it('beim Abmelden ist alles vom Gerät weg', () => {
    localStorage.setItem(OFFLINE_SNAPSHOT_KEY, '{}');
    localStorage.setItem(OFFLINE_QUEUE_KEY, '[]');
    clearOfflineData();
    expect(localStorage.getItem(OFFLINE_SNAPSHOT_KEY)).toBeNull();
    expect(localStorage.getItem(OFFLINE_QUEUE_KEY)).toBeNull();
  });
});
