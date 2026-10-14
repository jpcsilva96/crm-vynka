import { create } from "zustand";

interface PipelineNavState {
  showCreateDeal: boolean;
  defaultPhone?: string;
  defaultName?: string;
  defaultContactId?: string;
  openDealId?: string;
  triggerCreateDeal: (phone?: string, name?: string, contactId?: string) => void;
  triggerOpenDeal: (dealId: string) => void;
  clearState: () => void;
}

export const usePipelineNavigationStore = create<PipelineNavState>((set) => ({
  showCreateDeal: false,
  triggerCreateDeal: (phone, name, contactId) => set({ showCreateDeal: true, defaultPhone: phone, defaultName: name, defaultContactId: contactId, openDealId: undefined }),
  triggerOpenDeal: (dealId) => set({ openDealId: dealId, showCreateDeal: false }),
  clearState: () => set({ showCreateDeal: false, defaultPhone: undefined, defaultName: undefined, defaultContactId: undefined, openDealId: undefined })
}));
