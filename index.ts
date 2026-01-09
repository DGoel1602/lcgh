import { mkdir, writeFile } from "fs/promises";
import { $, argv } from "bun";

const LEETCODE_SESSION = process.env.LEETCODE_SESSION!;
const CSRF_TOKEN = process.env.CSRF_TOKEN!;

if (!LEETCODE_SESSION || !CSRF_TOKEN) {
  console.error("Set all env variables, see README for all required");
  process.exit(1);
}

const GRAPHQL = "https://leetcode.com/graphql";

const headers = {
  "Content-Type": "application/json",
  "X-CSRFToken": CSRF_TOKEN,
  Referer: "https://leetcode.com/",
  Cookie: `LEETCODE_SESSION=${LEETCODE_SESSION}; csrftoken=${CSRF_TOKEN}`,
};

async function gql(query: string, variables: any) {
  const res = await fetch(GRAPHQL, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const json = (await res.json()) as any;
  if (json.errors) {
    console.error(JSON.stringify(json.errors, null, 2));
    throw new Error("GraphQL error");
  }
  return json.data;
}

const SUBMISSION_LIST_QUERY = `
query submissionList($offset: Int!, $limit: Int!, $lastKey: String) {
  submissionList(offset: $offset, limit: $limit, lastKey: $lastKey) {
    hasNext
    lastKey
    submissions {
      id
      title
      titleSlug
      statusDisplay
      lang
      timestamp
    }
  }
}
`;

type Submission = {
  id: number;
  title: string;
  titleSlug: string;
  statusDisplay: string;
  lang: string;
  timestamp: number;
};

async function getAllSubmissions(): Promise<Submission[]> {
  let offset = 0;
  let lastKey: string | null = null;
  const limit = 10;
  const all: Submission[] = [];

  const now = Math.floor(Date.now() / 1000);
  const ONE_MONTH_SECONDS = 30 * 24 * 60 * 60;
  const cutoff = now - ONE_MONTH_SECONDS;

  while (true) {
    const data = await gql(SUBMISSION_LIST_QUERY, { offset, limit, lastKey });

    console.log(`Fetching submissions ${offset}..${offset + limit}`);

    const page = data.submissionList;

    for (const sub of page.submissions) {
      if (Number(sub.timestamp) < cutoff) return all;
      all.push(sub);
    }

    if (!page.hasNext) break;

    lastKey = page.lastKey;
    offset += limit;
  }

  return all;
}

function latestAccepted(subs: Submission[]) {
  const map = new Map<string, Submission>();
  for (const s of subs) {
    if (s.statusDisplay !== "Accepted") continue;

    const prev = map.get(s.titleSlug);
    if (!prev || s.timestamp > prev.timestamp) map.set(s.titleSlug, s);
  }
  return [...map.values()];
}

const SUBMISSION_DETAIL_QUERY = `
query submissionDetails($submissionId: Int!) {
  submissionDetails(submissionId: $submissionId) {
    code
    lang { name verboseName }
    timestamp
    statusCode
  }
}
`;

async function getCode(id: number) {
  const data = await gql(SUBMISSION_DETAIL_QUERY, { submissionId: id });
  return data.submissionDetails as {
    code: string;
    lang: { name: string };
  } | null;
}

const QUESTION_QUERY = `
query questionTitle($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId
    difficulty
  }
}
`;

async function getQuestionInfo(
  slug: string,
): Promise<{ qid: string; difficulty: string }> {
  const data = await gql(QUESTION_QUERY, { titleSlug: slug });
  return {
    qid: data.question.questionFrontendId,
    difficulty: data.question.difficulty.toLowerCase(),
  };
}

const EXT: Record<string, string> = {
  cpp: "cpp",
  python3: "py",
  javascript: "js",
  c: "c",
  golang: "go",
  rust: "rs",
};

async function syncSolutionsLocally() {
  await mkdir("../solutions/easy", { recursive: true });
  await mkdir("../solutions/medium", { recursive: true });
  await mkdir("../solutions/hard", { recursive: true });

  const all = await getAllSubmissions();
  const latest = latestAccepted(all);
  let problemCount = 0;

  for (const s of latest) {
    const data = await getCode(s.id);
    if (!data) continue;
    problemCount++;

    const { code, lang: langObj } = data;
    const lang = langObj.name;

    const { qid, difficulty } = await getQuestionInfo(s.titleSlug);
    const ext = EXT[lang] ?? "txt";

    const folder = `../solutions/${difficulty}`;
    await mkdir(folder, { recursive: true });

    console.log(`Writing solution ${qid} to ${difficulty}/`);

    const file = `${folder}/${qid}.${ext}`;
    await writeFile(file, code);
  }

  console.log(`Wrote ${problemCount} submissions to solutions/`);
}

export async function syncRepo() {
  const REPO_URL = process.env.REPO_URL;
  if (!REPO_URL) {
    console.error("REPO_URL env variable not set");
    process.exit(1);
  }

  process.chdir("../solutions");

  const isGitRepo = await $`git rev-parse --is-inside-work-tree`.quiet().then(
    () => true,
    () => false,
  );

  if (!isGitRepo) await $`git init`;

  //Idk if we should do this but wtv
  await $`git branch -M master`;

  const hasOrigin = await $`git remote get-url origin`.quiet().then(
    () => true,
    () => false,
  );

  if (!hasOrigin) await $`git remote add origin ${REPO_URL}`;
  else await $`git remote set-url origin ${REPO_URL}`;

  try {
    await $`git fetch origin`;
    await $`git reset --soft origin/master`.quiet();
  } catch (e) {
    console.log("Fresh history maybe probably Im guessing");
    console.error(e);
  }

  const status = await $`git status --porcelain`.text();
  const changedFiles = status.split("\n").filter((line) => line.trim() !== "");
  const changedCount = changedFiles.length;

  if (changedCount === 0) {
    console.log("No changes detected, skipping commit.");
    return;
  }

  console.log(`Detected ${changedCount} changed files`);

  await $`git add .`;
  await $`git commit -m ${`chore(solutions): updated ${changedCount} submissions`}`;
  await $`git push -u origin HEAD`;
}

async function main() {
  if (!argv.includes("--no-lc-sync")) await syncSolutionsLocally();
  if (!argv.includes("--no-gh-sync")) await syncRepo();
}

main();
