/**
 * ComponentRegistry.ts - Central registry mapping component names (strings) to React components.
 * The backend Agent selects components by name from this registry via COMPONENT_SPEC JSON.
 * To add a new component: import it, then add its name as a key here.
 * Domain-specific: CompoundInterestChart, EmergencyBufferComparison, RiskReturnScatter, etc.
 * Universal: ConceptMap, MultipleChoice (work for any domain).
 */
import React from 'react';
import CompoundInterestChart from './CompoundInterestChart';
import { EmergencyBufferComparison } from './EmergencyBufferComparison';
import RiskReturnScatter from './RiskReturnScatter';
import InflationTimeline from './InflationTimeline';
import AssetAllocationPie from './AssetAllocationPie';
import ConceptMap from './ConceptMap';
import MultipleChoice from './MultipleChoice';

export const ComponentRegistry: Record<string, React.ComponentType<any>> = {
  CompoundInterestChart,
  EmergencyBufferComparison,
  RiskReturnScatter,
  InflationTimeline,
  AssetAllocationPie,
  ConceptMap,
  MultipleChoice,
};
