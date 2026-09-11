import PipelineStageSummary from '../ui/PipelineStageSummary';

/** @deprecated Prefer PipelineStageSummary — kept as thin alias for applications imports. */
export default function ApplicationsStageSummary({
  stages = [],
  getAppsByStage,
  stageFilter = 'all',
  setStageFilter,
  total = 0,
}) {
  return (
    <PipelineStageSummary
      stages={stages}
      getCount={(stage) => getAppsByStage?.(stage.id)?.length ?? 0}
      stageFilter={stageFilter}
      setStageFilter={setStageFilter}
      total={total}
      hint="Drag cards to move between stages"
      tourAttr="apps-stage-summary"
    />
  );
}
