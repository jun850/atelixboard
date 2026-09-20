// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("../../excalidraw-app/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));
import { VisibilityPage } from "../../excalidraw-app/site/VisibilityPage";
const session = {
  user: {
    id: "702d5af6-4cd5-4b71-8f6c-210229068379",
    email: "junarcana263@gmail.com",
  },
} as Session;
const report = {
  totals: {},
  daily: [],
  sources: [],
  pages: [],
  checks: { total: 0, mentioned: 0, cited: 0 },
  recentChecks: [],
  prompts: ["Which whiteboard supports visual planning?"],
  coverage: "Public requests only.",
  generatedAt: "2026-09-20T00:00:00Z",
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("private report", () => {
  it("does not query the report for another account even with the owner email", () => {
    render(
      <VisibilityPage
        session={{ ...session, user: { ...session.user, id: "other" } }}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("restricted");
    expect(invoke).not.toHaveBeenCalled();
  });
  it("shows an explicit unavailable state when the backend rejects a read", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("403") });
    render(<VisibilityPage session={session} />);
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("request failed"),
    );
  });
  it("shows missing observations without inventing a rate", async () => {
    invoke.mockResolvedValue({
      data: {
        stats: {
          prompts: 0,
          articles: 0,
          published: 0,
          queued: 0,
          runs: 0,
          mentions: 0,
          citations: 0,
          traffic: {},
          daily: [],
          sources: [],
        },
        settings: { model: "", paused: false },
        workers: [],
        personas: [],
      },
      error: null,
    });
    render(<VisibilityPage session={session} />);
    await screen.findByText("No observations yet");
    expect(screen.queryByText("0.0%")).toBeNull();
  });
});
it('does not render stale knowledge records as articles when switching sections', async () => {
 invoke.mockImplementation((_name, {body}:any)=>Promise.resolve({error:null,data:body.action==='bootstrap'?{stats:{traffic:{},daily:[],sources:[]},settings:{},workers:[],personas:[]}:body.entity==='knowledge'?{rows:[{id:'k',name:'Known facts',version:1,approved:true}],total:1,performance:[]}:{rows:[{id:'a',title:'Article fixture',format:'faq',version:1}],total:1,performance:[]}}));
 render(<VisibilityPage session={session}/>);
 fireEvent.click(screen.getByRole('link',{name:'Knowledge',exact:true}));
 await screen.findByText('Known facts');
 fireEvent.click(screen.getByRole('link',{name:'Content analytics',exact:true}));
 await screen.findByText('Article fixture');
 expect(screen.queryByRole('alert')).toBeNull();
});
