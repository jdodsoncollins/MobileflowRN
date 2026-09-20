import { describe, expect, it } from 'vitest';
import { ConfirmationPolicy } from '../src/domain/policies/confirmationPolicy';
import { collectionID, itemID, pageID, siteID } from '../src/domain/models/ids';

const policy = ConfirmationPolicy.default;
const site = siteID('site_test');

describe('ConfirmationPolicy', () => {
  it('publish requires hard confirmation', () => {
    const action = {
      type: 'publishSite' as const,
      input: {
        siteID: site,
        customDomainIDs: [],
        publishToWebflowSubdomain: true,
      },
    };
    expect(policy.requirement(action)).toBe('hardConfirm');
    expect(policy.risk(action)).toBe('high');
  });

  it('slug change is high risk', () => {
    const action = {
      type: 'updatePageMetadata' as const,
      input: {
        pageID: pageID('page_test'),
        slug: '/new-slug',
      },
    };
    expect(policy.risk(action)).toBe('high');
  });

  it('metadata update is medium risk', () => {
    const action = {
      type: 'updatePageMetadata' as const,
      input: {
        pageID: pageID('page_test'),
        seoTitle: 'New Title',
        seoDescription: 'New description',
      },
    };
    expect(policy.risk(action)).toBe('medium');
    expect(policy.requirement(action)).toBe('review');
  });

  it('readOnly skips confirmation', () => {
    const action = {
      type: 'readSiteSummary' as const,
      siteID: site,
    };
    expect(policy.requirement(action)).toBe('none');
    expect(policy.risk(action)).toBe('readOnly');
  });

  it('designer actions are headless (no live session required)', () => {
    const action = {
      type: 'updateDesignerVariable' as const,
      input: {
        variableID: 'brand-blue',
        value: '#000',
        branchID: 'branch-1',
      },
    };
    expect(policy.requiresLiveSession(action)).toBe(false);
    const d = policy.descriptor(action, site);
    expect(d.requiresLiveSession).toBe(false);
  });

  it('CMS item publish requires hard confirmation and is not site-wide', () => {
    const action = {
      type: 'publishCMSItems' as const,
      input: {
        collectionID: collectionID('col_1'),
        itemIDs: [itemID('item_1')],
      },
    };
    expect(policy.requirement(action)).toBe('hardConfirm');
    expect(policy.risk(action)).toBe('high');
    expect(policy.descriptor(action, site).summary).toContain(
      'does not republish the whole site',
    );
  });

  it('comment reply is a low-risk write', () => {
    const action = {
      type: 'replyToComment' as const,
      input: {
        siteID: site,
        threadID: 'thread_1',
        content: 'Thanks',
      },
    };
    expect(policy.risk(action)).toBe('low');
    expect(policy.requirement(action)).toBe('inline');
  });

  it('form submission delete is destructive', () => {
    const action = {
      type: 'deleteFormSubmission' as const,
      input: { formID: 'form_1', submissionID: 'sub_1' },
    };
    expect(policy.requirement(action)).toBe('destructiveConfirm');
    expect(policy.risk(action)).toBe('destructive');
  });

  it('publish does not require live session', () => {
    const action = {
      type: 'publishSite' as const,
      input: {
        siteID: site,
        customDomainIDs: [],
        publishToWebflowSubdomain: true,
      },
    };
    expect(policy.requiresLiveSession(action)).toBe(false);
  });

  it('descriptor titles match iOS', () => {
    const d = policy.descriptor(
      {
        type: 'updatePageMetadata',
        input: { pageID: pageID('p1'), seoTitle: 'T' },
      },
      site,
    );
    expect(d.title).toBe('Update Page Metadata');
    expect(d.confirmation).toBe('review');
  });
});
