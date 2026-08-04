import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { listPlans } from '@/api/plans';
import { listAccessibleProjects } from '@/api/projects';
import { useAuth } from '@/auth/authContext';
import { LoadingScreen } from '@/auth/guards';
import { CaptureBar } from '@/components/CaptureBar';
import { FooterActions } from '@/components/FooterActions';
import { ItemList } from '@/components/ItemList';
import { MarkupSheet } from '@/components/MarkupSheet';
import { Masthead } from '@/components/Masthead';
import { ReportHeaderForm } from '@/components/ReportHeaderForm';
import { StatusLine } from '@/components/StatusLine';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useConnectivityFlash } from '@/hooks/useConnectivityFlash';
import { downscaleToDataUrl, loadImage, readFileAsDataUrl } from '@/lib/image';
import { prefetchPlans } from '@/lib/planCache';
import { createItemId } from '@/lib/report';
import { ProjectProvider } from '@/state/ProjectProvider';
import { ReportProvider } from '@/state/ReportProvider';
import { useReport } from '@/state/reportContext';
import { LocalReportRepository } from '@/storage/localReportRepository';
import type { Project } from '@/types/db';
import type { ReportItem } from '@/types/report';

/** Última obra abierta, para no obligar a elegirla en cada arranque. */
const LAST_PROJECT_KEY = 'svr_last_project';

function newDraft(src: string, ts: number): ReportItem {
  return { id: createItemId(), no: null, src, ts, zone: '', cmt: '', plan: null };
}

export function CapturePage() {
  const { isAppOwner, leaderOrgs } = useAuth();
  const projects = useAsyncData(listAccessibleProjects, []);
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    localStorage.getItem(LAST_PROJECT_KEY)
  );

  const active = useMemo(() => {
    const list = projects.data ?? [];
    return list.find((p) => p.id === selectedId) ?? list[0] ?? null;
  }, [projects.data, selectedId]);

  const selectProject = useCallback((id: string) => {
    setSelectedId(id);
    localStorage.setItem(LAST_PROJECT_KEY, id);
  }, []);

  const loadPlansFor = useCallback(
    () => (active ? listPlans(active.id) : Promise.resolve([])),
    [active]
  );
  const plans = useAsyncData(loadPlansFor, [active?.id]);

  // Bajar las láminas mientras todavía hay señal es lo que permite que el
  // plano se abra en la obra. Se hace al entrar, no al tocar cada chip.
  useEffect(() => {
    if (plans.data?.length) void prefetchPlans(plans.data.map((plan) => plan.storage_path));
  }, [plans.data]);

  /**
   * Un reporte por proyecto. Antes había uno solo, porque no había
   * proyectos; mezclarlos ahora sería juntar observaciones de dos obras
   * distintas en el mismo PDF.
   */
  const repository = useMemo(
    () => (active ? new LocalReportRepository(`svr_state_v1:${active.id}`) : null),
    [active]
  );

  if (projects.loading) return <LoadingScreen message="Cargando proyectos…" />;

  if (projects.error) {
    return (
      <div className="adm-center">
        <p className="adm-error">{projects.error}</p>
      </div>
    );
  }

  if (!active || !repository) {
    const canAdminister = isAppOwner || leaderOrgs.length > 0;
    return (
      <div className="adm-center">
        <div style={{ maxWidth: 380, padding: 24 }}>
          <p className="adm-muted">
            No tienes ninguna obra asignada todavía. Quien dirija tu empresa tiene que asignarte a
            un proyecto para que puedas levantar reportes.
          </p>
          {canAdminister && <Link to="/empresa">Ir a la administración</Link>}
        </div>
      </div>
    );
  }

  return (
    <ProjectProvider project={active} plans={plans.data ?? []}>
      {/* key: cambiar de obra remonta el estado del reporte entero. */}
      <ReportProvider key={active.id} repository={repository}>
        <CaptureScreen
          projects={projects.data ?? []}
          project={active}
          onSelectProject={selectProject}
          plansLoading={plans.loading}
        />
      </ReportProvider>
    </ProjectProvider>
  );
}

interface ScreenProps {
  projects: readonly Project[];
  project: Project;
  onSelectProject(id: string): void;
  plansLoading: boolean;
}

function CaptureScreen({ projects, project, onSelectProject, plansLoading }: ScreenProps) {
  const { flash, saveItem, state, updateHeader, ready } = useReport();
  const { isAppOwner, leaderOrgs } = useAuth();
  const [editing, setEditing] = useState<ReportItem | null>(null);
  /**
   * Cola de fotos pendientes cuando se eligen varias de la galería. Se
   * procesan de una en una: cada foto necesita su propia observación, y
   * abrir seis editores a la vez no ayuda a nadie en obra.
   */
  const pendingRef = useRef<File[]>([]);

  useConnectivityFlash(flash);

  // El nombre del proyecto manda: es lo que sale impreso en el PDF.
  useEffect(() => {
    if (ready && state.proj !== project.name) updateHeader({ proj: project.name });
  }, [ready, state.proj, project.name, updateHeader]);

  const openFromFile = useCallback(
    async (file: File) => {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const image = await loadImage(dataUrl);
        setEditing(newDraft(downscaleToDataUrl(image), file.lastModified || Date.now()));
      } catch {
        flash('That file would not open as an image');
        const next = pendingRef.current.shift();
        if (next) void openFromFile(next);
      }
    },
    [flash]
  );

  const nextPending = useCallback(() => {
    const next = pendingRef.current.shift();
    if (next) void openFromFile(next);
  }, [openFromFile]);

  const handleFiles = useCallback(
    (files: FileList) => {
      const list = Array.from(files);
      const [first, ...rest] = list;
      if (!first) return;
      if (list.length > 1) flash(`Adding ${list.length} photos, one at a time`);
      pendingRef.current = rest;
      void openFromFile(first);
    },
    [flash, openFromFile]
  );

  return (
    <div className="svr">
      <Masthead />
      <ReportHeaderForm
        projects={projects}
        activeProjectId={project.id}
        onSelectProject={onSelectProject}
      />
      <CaptureBar onFiles={handleFiles} />
      <StatusLine />
      <ItemList onEdit={setEditing} />

      <div className="note">
        {plansLoading && 'Downloading plan sheets… '}
        Data stays on this device. Export the PDF and file it before clearing. Item numbers are
        permanent - deleting an item leaves a gap rather than renumbering.
        {(isAppOwner || leaderOrgs.length > 0) && (
          <>
            {' '}
            <Link to="/empresa">Volver a la administración</Link>.
          </>
        )}
      </div>

      <FooterActions />

      {editing && (
        <MarkupSheet
          key={editing.id}
          item={editing}
          onCancel={() => {
            setEditing(null);
            nextPending();
          }}
          onSave={(updated) => {
            saveItem(updated);
            setEditing(null);
            nextPending();
          }}
        />
      )}
    </div>
  );
}
