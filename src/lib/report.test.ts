import { describe, expect, it } from 'vitest';
import {
  autoRef,
  buildFilename,
  orderItems,
  reconcileItemNumbers,
  referencedPlanIds,
  todayLocal,
} from './report';
import { emptyReportState, type ReportItem } from '@/types/report';

function item(partial: Partial<ReportItem> & { id: string }): ReportItem {
  return {
    no: null,
    src: '',
    ts: 0,
    zone: '',
    cmt: '',
    plan: null,
    ...partial,
  };
}

describe('todayLocal', () => {
  it('usa la fecha local, no UTC', () => {
    // 23:30 local del 5 de marzo. En UTC ya seria dia 6 en husos negativos;
    // la visita se fecha por el reloj de quien la hace.
    const local = new Date(2026, 2, 5, 23, 30);
    expect(todayLocal(local)).toBe('2026-03-05');
  });

  it('rellena mes y dia a dos digitos', () => {
    expect(todayLocal(new Date(2026, 0, 9))).toBe('2026-01-09');
  });
});

describe('autoRef', () => {
  it('construye el numero de reporte a partir de la fecha', () => {
    expect(autoRef('2026-07-21')).toBe('SVR-20260721-A');
  });

  it('cae a hoy si no hay fecha', () => {
    expect(autoRef('')).toMatch(/^SVR-\d{8}-A$/);
  });
});

describe('orderItems', () => {
  const canonical = ['Lobby', 'Roof'];

  it('respeta el orden canonico de zonas del proyecto', () => {
    const items = [
      item({ id: 'a', zone: 'Roof' }),
      item({ id: 'b', zone: 'Lobby' }),
      item({ id: 'c', zone: 'Lobby' }),
    ];
    expect(orderItems(items, canonical).map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('pone las zonas escritas a mano despues, en orden de aparicion', () => {
    const items = [
      item({ id: 'a', zone: 'Garage' }),
      item({ id: 'b', zone: 'Lobby' }),
      item({ id: 'c', zone: 'Basement' }),
    ];
    expect(orderItems(items, canonical).map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  it('agrupa los items sin zona bajo Unassigned', () => {
    const items = [item({ id: 'a', zone: '' }), item({ id: 'b', zone: 'Lobby' })];
    expect(orderItems(items, canonical).map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('no pierde ni duplica items', () => {
    const items = [
      item({ id: 'a', zone: 'Roof' }),
      item({ id: 'b', zone: '' }),
      item({ id: 'c', zone: 'Garage' }),
      item({ id: 'd', zone: 'Lobby' }),
    ];
    expect(orderItems(items, canonical)).toHaveLength(items.length);
  });
});

describe('reconcileItemNumbers', () => {
  it('respeta los numeros ya asignados', () => {
    const state = {
      ...emptyReportState(),
      seq: 3,
      items: [item({ id: 'a', no: 1 }), item({ id: 'b', no: 3 })],
    };
    const result = reconcileItemNumbers(state);
    expect(result.items.map((i) => i.no)).toEqual([1, 3]);
    expect(result.seq).toBe(3);
  });

  it('numera los items que llegan sin numero', () => {
    const state = {
      ...emptyReportState(),
      seq: 2,
      items: [item({ id: 'a', no: 2 }), item({ id: 'b', no: null })],
    };
    const result = reconcileItemNumbers(state);
    expect(result.items.map((i) => i.no)).toEqual([2, 3]);
    expect(result.seq).toBe(3);
  });

  it('nunca reutiliza el numero de un item borrado', () => {
    // El item 2 se borro: seq sigue en 3 y el hueco se queda.
    const state = {
      ...emptyReportState(),
      seq: 3,
      items: [item({ id: 'a', no: 1 }), item({ id: 'c', no: 3 })],
    };
    const result = reconcileItemNumbers(state);
    expect(result.seq).toBe(3);
    expect(result.items.map((i) => i.no)).toEqual([1, 3]);
  });

  it('sube seq si algun item lo supera', () => {
    const state = {
      ...emptyReportState(),
      seq: 1,
      items: [item({ id: 'a', no: 9 })],
    };
    expect(reconcileItemNumbers(state).seq).toBe(9);
  });
});

describe('buildFilename', () => {
  it('sanea proyecto y referencia', () => {
    const state = {
      ...emptyReportState(),
      proj: 'CORA Merrick Park',
      ref: 'SVR-20260721-A',
      date: '2026-07-21',
    };
    expect(buildFilename(state)).toBe('CORA_Merrick_Park_SVR_20260721_A_2026-07-21.pdf');
  });

  it('cae a valores por defecto cuando falta cabecera', () => {
    const state = { ...emptyReportState(), date: '2026-07-21' };
    expect(buildFilename(state)).toBe('SiteVisit_SVR_2026-07-21.pdf');
  });
});

describe('referencedPlanIds', () => {
  it('devuelve cada lamina una sola vez, en orden de aparicion', () => {
    const items = [
      item({ id: 'a', plan: { id: '103', x: 0.1, y: 0.1 } }),
      item({ id: 'b', plan: null }),
      item({ id: 'c', plan: { id: '101', x: 0.2, y: 0.2 } }),
      item({ id: 'd', plan: { id: '103', x: 0.3, y: 0.3 } }),
    ];
    expect(referencedPlanIds(items)).toEqual(['103', '101']);
  });
});
