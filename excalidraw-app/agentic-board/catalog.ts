export const CATEGORIES = [
  "Diagrams and engineering",
  "Brainstorming",
  "Meetings and research",
  "Product and design",
  "Planning and delivery",
  "Strategy",
  "Communication",
] as const;
export type Layout =
  | "flow"
  | "layers"
  | "sequence"
  | "tables"
  | "tree"
  | "mind"
  | "grid"
  | "lanes"
  | "document"
  | "journey"
  | "stories"
  | "desktop"
  | "mobile"
  | "components"
  | "timeline"
  | "business"
  | "matrix"
  | "frames";
export type Content = {
  title: string;
  sections: { heading: string; items: string[] }[];
  assumptions: string[];
};
export type Template = {
  id: string;
  version: 1;
  title: string;
  category: string;
  description: string;
  layout: Layout;
  headings: string[];
};
const entries: [string, string, number, Layout, string, string[]][] = [
  [
    "flowchart",
    "Flowchart",
    0,
    "flow",
    "Map a process, its decisions and outcomes.",
    ["Start", "Collect input", "Review decision", "Make changes", "Finish"],
  ],
  [
    "system-architecture",
    "System architecture",
    0,
    "layers",
    "Explain services and how they connect.",
    ["People and clients", "Application services", "Data and infrastructure"],
  ],
  [
    "sequence-diagram",
    "Sequence diagram",
    0,
    "sequence",
    "Trace messages between three participants.",
    ["Client", "Service", "Database"],
  ],
  [
    "uml-class",
    "UML class diagram",
    0,
    "tables",
    "Describe classes, attributes and methods.",
    ["Class A", "Class B", "Class C", "Class D"],
  ],
  [
    "entity-relationship",
    "Entity relationship diagram",
    0,
    "tables",
    "Map entities, keys and cardinalities.",
    ["Entity A", "Entity B", "Entity C", "Entity D"],
  ],
  [
    "org-chart",
    "Org chart",
    0,
    "tree",
    "Make reporting relationships clear.",
    ["Lead role", "Team A", "Team B", "Role A", "Role B", "Role C", "Role D"],
  ],
  [
    "mind-map",
    "Mind map",
    1,
    "mind",
    "Explore a central idea in five directions.",
    ["Branch A", "Branch B", "Branch C", "Branch D", "Branch E"],
  ],
  [
    "idea-collection",
    "Idea collection",
    1,
    "lanes",
    "Give a brainstorm room to grow.",
    ["Idea area A", "Idea area B", "Idea area C"],
  ],
  [
    "affinity-map",
    "Affinity map",
    1,
    "lanes",
    "Group ideas into meaningful clusters.",
    ["Cluster A", "Cluster B", "Cluster C", "Cluster D"],
  ],
  [
    "concept-map",
    "Concept map",
    1,
    "mind",
    "Connect concepts with named relationships.",
    [
      "Concept A",
      "Concept B",
      "Concept C",
      "Concept D",
      "Concept E",
      "Concept F",
    ],
  ],
  [
    "meeting-agenda",
    "Meeting agenda and actions",
    2,
    "grid",
    "Capture the goal, discussion and next steps.",
    ["Goal", "Agenda", "Decisions", "Actions · owner/date TBD"],
  ],
  [
    "interview-plan",
    "Interview plan and notes",
    2,
    "grid",
    "Prepare questions and leave space for evidence.",
    [
      "Research goal",
      "Questions",
      "Notes · not yet collected",
      "Insights · to validate",
    ],
  ],
  [
    "workshop-agenda",
    "Workshop agenda",
    2,
    "timeline",
    "Plan four activities around an outcome.",
    ["Opening", "Explore", "Synthesize", "Next steps"],
  ],
  [
    "prd",
    "PRD",
    3,
    "document",
    "Turn a product idea into seven editable sections.",
    [
      "Problem",
      "Users",
      "Goals",
      "Scope",
      "Requirements",
      "Success measures",
      "Open questions",
    ],
  ],
  [
    "user-journey",
    "User journey",
    3,
    "journey",
    "See actions, pain points and opportunities by stage.",
    ["Discover", "Explore", "Decide", "Use", "Return"],
  ],
  [
    "user-story-map",
    "User story map",
    3,
    "stories",
    "Arrange stories beneath activities and releases.",
    ["Activity A", "Activity B", "Activity C", "Activity D"],
  ],
  [
    "desktop-wireframe",
    "Desktop wireframe",
    3,
    "desktop",
    "Sketch a screen with editable native controls.",
    ["Navigation", "Screen heading", "Main content", "Primary action"],
  ],
  [
    "mobile-wireframe",
    "Mobile wireframe",
    3,
    "mobile",
    "Explore a phone screen and its navigation.",
    ["Screen title", "Content", "Primary action", "Navigation"],
  ],
  [
    "ui-component-sheet",
    "UI component sheet",
    3,
    "components",
    "Compare buttons, inputs, cards and navigation.",
    ["Buttons", "Inputs", "Cards", "Navigation"],
  ],
  [
    "kanban",
    "Kanban",
    4,
    "lanes",
    "Move editable cards from intention to done.",
    ["To do", "In progress", "Done"],
  ],
  [
    "sprint-planning",
    "Sprint planning",
    4,
    "grid",
    "Align the goal, backlog, capacity and commitments.",
    ["Sprint goal", "Backlog", "Capacity · TBD", "Commitments · proposed"],
  ],
  [
    "retrospective",
    "Retrospective",
    4,
    "lanes",
    "Reflect on Start, Stop, Continue and actions.",
    ["Start", "Stop", "Continue", "Actions · owner/date TBD"],
  ],
  [
    "roadmap",
    "Roadmap",
    4,
    "lanes",
    "Organize initiatives without inventing dates.",
    ["Now", "Next", "Later"],
  ],
  [
    "gantt",
    "Gantt chart",
    4,
    "timeline",
    "An illustrative, undated five-task timeline.",
    ["Task A", "Task B", "Task C", "Task D", "Task E"],
  ],
  [
    "swot",
    "SWOT",
    5,
    "grid",
    "Explore strengths, weaknesses, opportunities and threats.",
    ["Strengths", "Weaknesses", "Opportunities", "Threats"],
  ],
  [
    "business-model-canvas",
    "Business model canvas",
    5,
    "business",
    "Explore the nine parts of a business model.",
    [
      "Key partners",
      "Key activities",
      "Key resources",
      "Value propositions",
      "Customer relationships",
      "Channels",
      "Customer segments",
      "Cost structure",
      "Revenue streams",
    ],
  ],
  [
    "impact-effort",
    "Impact–effort matrix",
    5,
    "matrix",
    "Discuss suggested priorities across four quadrants.",
    [
      "High impact · low effort",
      "High impact · high effort",
      "Low impact · low effort",
      "Low impact · high effort",
    ],
  ],
  [
    "storyboard",
    "Storyboard",
    6,
    "frames",
    "Tell a scenario in six editable panels.",
    ["Scene 1", "Scene 2", "Scene 3", "Scene 4", "Scene 5", "Scene 6"],
  ],
  [
    "presentation-frames",
    "Presentation frames",
    6,
    "frames",
    "Build a story across five canvas slides.",
    ["Introduction", "Context", "Idea", "Evidence · to supply", "Next steps"],
  ],
];
export const templates: Template[] = entries.map(
  ([id, title, category, layout, description, headings]) => ({
    id,
    title,
    category: CATEGORIES[category],
    layout,
    description,
    headings,
    version: 1,
  }),
);
export const defaultContent = (
  template: Template,
  title = template.title,
): Content => ({
  title,
  sections: template.headings.map((heading) => ({
    heading,
    items:
      template.id === "uml-class"
        ? ["+ attribute: Type", "+ method(): Result"]
        : template.id === "entity-relationship"
        ? ["PK id", "FK related_id", "attribute: type"]
        : template.layout === "journey"
        ? [
            "Action · TBD",
            "Pain point · to research",
            "Opportunity · hypothesis",
          ]
        : ["Add your content", "Add your content", "Add your content"],
  })),
  assumptions: ["Blank template: placeholders are not confirmed facts."],
});
export function validateContent(value: unknown, template: Template): Content {
  const v = value as Content;
  if (
    !v ||
    typeof v.title !== "string" ||
    !v.title.trim() ||
    v.title.length > 160 ||
    !Array.isArray(v.sections) ||
    v.sections.length !== template.headings.length ||
    !Array.isArray(v.assumptions) ||
    v.assumptions.length > 12 ||
    v.assumptions.some((s) => typeof s !== "string" || s.length > 500) ||
    v.sections.some(
      (s) =>
        !s ||
        typeof s.heading !== "string" ||
        !s.heading.trim() ||
        s.heading.length > 100 ||
        !Array.isArray(s.items) ||
        s.items.length > 6 ||
        s.items.some((x) => typeof x !== "string" || x.length > 300),
    )
  ) {
    throw new Error(
      "The draft does not match this template. Try a shorter request.",
    );
  }
  return {
    title: v.title,
    sections: v.sections.map((s) => ({
      heading: s.heading,
      items: [...s.items],
    })),
    assumptions: [...v.assumptions],
  };
}
