/** Designer canvas models — only populated from live MCP, never fixtures. */

export type VariableType = 'color' | 'spacing' | 'typography' | 'size';

export const variableTypeDisplayName: Record<VariableType, string> = {
  color: 'Color',
  spacing: 'Spacing',
  typography: 'Typography',
  size: 'Size',
};

export interface DesignerVariable {
  id: string;
  name: string;
  type: VariableType;
  value: string;
  collection?: string | null;
  usageCount: number;
}

export type PropType = 'plainText' | 'richText' | 'image' | 'link';

export interface ComponentProp {
  id: string;
  name: string;
  label: string;
  type: PropType;
  value: string;
  isLocalized: boolean;
}

export interface DesignerComponent {
  id: string;
  name: string;
  group?: string | null;
  description?: string | null;
  isReadonly: boolean;
  props: ComponentProp[];
}

export interface DesignerBranch {
  id: string;
  name: string;
  isActive: boolean;
}
