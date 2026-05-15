'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Check, Plus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AISuggestionsChipsProps {
  /** AI-suggested tags. */
  suggestedTags: string[];
  /** AI-suggested search aliases. */
  suggestedAliases: string[];
  /** AI-suggested category, if confident. */
  suggestedCategory?: string;

  /** Currently approved tags on the product. */
  approvedTags: string[];
  /** Currently approved aliases on the product. */
  approvedAliases: string[];
  /** Currently set category on the product. */
  currentCategory: string;

  /** Existing categories in this store (so we know if suggestion is new). */
  existingCategoryNames: string[];

  /** Toggle a tag on/off in approvedTags. */
  onToggleTag: (tag: string) => void;
  /** Toggle an alias on/off in approvedAliases. */
  onToggleAlias: (alias: string) => void;
  /** Apply the suggested category. If it's new, parent should create it. */
  onApplyCategory: (category: string, isNew: boolean) => void;
  /** Disabled state. */
  disabled?: boolean;
}

/**
 * AI Product Selling Assistant chips.
 *
 * Renders below the description textarea after the vendor clicks Generate
 * with AI. Vendor TAPS to add — nothing is auto-saved. This is deliberate:
 * a wrong tag pollutes search and the customer-facing AI more than a
 * missing one.
 *
 * If the vendor regenerates, the parent supplies new suggestions; chips
 * already approved stay in approvedTags/approvedAliases independent of
 * what's currently suggested.
 */
export function AISuggestionsChips(props: AISuggestionsChipsProps) {
  const {
    suggestedTags,
    suggestedAliases,
    suggestedCategory,
    approvedTags,
    approvedAliases,
    currentCategory,
    existingCategoryNames,
    onToggleTag,
    onToggleAlias,
    onApplyCategory,
    disabled,
  } = props;

  const hasAnything =
    suggestedTags.length > 0 ||
    suggestedAliases.length > 0 ||
    Boolean(suggestedCategory);

  if (!hasAnything) return null;

  const approvedTagSet = new Set(approvedTags.map((t) => t.toLowerCase()));
  const approvedAliasSet = new Set(approvedAliases.map((a) => a.toLowerCase()));

  const categoryIsNew =
    !!suggestedCategory &&
    !existingCategoryNames
      .map((n) => n.toLowerCase())
      .includes(suggestedCategory.toLowerCase());

  const categoryIsApplied =
    !!suggestedCategory &&
    currentCategory.trim().toLowerCase() === suggestedCategory.toLowerCase();

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span>
          Tap to add. These help customers and your AI assistant find this
          product faster.
        </span>
      </div>

      {suggestedTags.length > 0 && (
        <ChipRow
          label="Tags"
          chips={suggestedTags}
          activeSet={approvedTagSet}
          onToggle={onToggleTag}
          disabled={disabled}
        />
      )}

      {suggestedAliases.length > 0 && (
        <ChipRow
          label="Also known as"
          chips={suggestedAliases}
          activeSet={approvedAliasSet}
          onToggle={onToggleAlias}
          disabled={disabled}
        />
      )}

      {suggestedCategory && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Suggested category:
          </span>
          <Chip
            label={suggestedCategory}
            active={categoryIsApplied}
            onClick={() => onApplyCategory(suggestedCategory, categoryIsNew)}
            disabled={disabled}
          />
          {categoryIsNew && !categoryIsApplied && (
            <span className="text-[10px] text-muted-foreground">(new)</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Internal subcomponents ─────────────────────────────────────────────────

function ChipRow({
  label,
  chips,
  activeSet,
  onToggle,
  disabled,
}: {
  label: string;
  chips: string[];
  activeSet: Set<string>;
  onToggle: (chip: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground block">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <Chip
            key={chip}
            label={chip}
            active={activeSet.has(chip.toLowerCase())}
            onClick={() => onToggle(chip)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'default' : 'outline'}
      className={cn(
        'h-7 px-2.5 text-xs gap-1 transition-colors',
        active && 'bg-primary text-primary-foreground',
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {active ? (
        <Check className="h-3 w-3" />
      ) : (
        <Plus className="h-3 w-3" />
      )}
      {label}
    </Button>
  );
}