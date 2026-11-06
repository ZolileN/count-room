import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, EEID } from "@/lib/config";

export const metadata: Metadata = { title: "Method and sources" };

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="display mt-8 scroll-mt-28 text-2xl font-bold">
      {children}
    </h2>
  );
}

export default function MethodPage() {
  return (
    <article className="max-w-prose text-[15px] leading-relaxed [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
      <h1 className="display text-3xl font-bold sm:text-4xl">Method and sources</h1>
      <p className="text-ink-2">
        {APP_NAME} follows the provisional count for the 2026 local government elections. Everything here is arithmetic on
        what the Electoral Commission of South Africa (IEC) has published. Nothing on this site predicts, recommends or
        takes a side.
      </p>

      <H id="source">Where the numbers come from</H>
      <p>
        The IEC publishes its results dashboard data as public JSON files. We read them on our server (your browser never
        contacts the IEC), at most once a minute per file, and keep the last good copy if the IEC is slow or unavailable.
        Every figure shows the time the IEC reported it.
      </p>
      <ul>
        <li>The national file: national totals, every province and every council (top party only), seats and completion counts.</li>
        <li>Nine province files: each province&rsquo;s top 13 parties plus &ldquo;other&rdquo;, used for the projection.</li>
        <li>A council&rsquo;s own file, fetched only when you open that council: every party, every ward, every voting district.</li>
        <li>The same council&rsquo;s 2021 file and its 2026 ward boundaries, for the comparison and the ward map (these don&rsquo;t change, so we keep them for a day).</li>
      </ul>
      <p>
        Results are provisional until the IEC declares them. Electoral event IDs used: 2026 is {EEID[2026]}, 2021 is {EEID[2021]}.
      </p>

      <H id="count">The count</H>
      <p>
        Vote shares are the IEC&rsquo;s own: valid votes on the ward and PR ballots added together, as a share of all
        valid votes counted. &ldquo;Voting districts in&rdquo; is the share of voting districts whose results the IEC has
        captured. A council is <strong>hung</strong> when, once declared, no party holds more than half of its seats.
        Councils still counting are not classified.
      </p>
      <p>
        The IEC&rsquo;s national counters are sometimes a council or two ahead of the per-council records in the same
        file; the headline numbers use the counters, the council list uses the records.
      </p>

      <H id="projection">The projection</H>
      <p>
        Provinces count at different speeds. Early in the count, the raw national share is weighted towards whichever
        provinces have reported most. The projection corrects for that, province by province:
      </p>
      <ul>
        <li>
          For each province we take the share of voting districts still to report, and scale its valid votes up to a full
          count: projected votes = votes so far × districts expected ÷ districts reported.
        </li>
        <li>We assume the province&rsquo;s party shares stay as they are, then add the provinces back together.</li>
        <li>
          A province that has reported nothing yet is filled in at the national mix, sized by its registered voters.
        </li>
      </ul>
      <p>
        <strong>The range.</strong> Uncounted districts rarely vote exactly like counted ones. We simulate the count 3,000
        times. In each run, every party&rsquo;s share in each province moves by a random amount, larger where more of the
        province is still out (standard deviation (1.2 + 0.14 × share) × √(share uncounted), in percentage points); shares
        are kept at zero or above and rescaled to 100%. Each province&rsquo;s turnout also moves (standard deviation 6% ×
        √(share uncounted)). The range shown runs from the 5th to the 95th percentile. The random numbers are seeded from
        the data, so the same data always gives the same range.
      </p>
      <p>Known limitations:</p>
      <ul>
        <li>
          It corrects for which <em>provinces</em> are behind, not for which areas within a province are behind. If a
          province&rsquo;s cities count later than its rural areas, the projection will still lean the same way as the
          count in that province.
        </li>
        <li>
          For parties under about 1%, the range is skewed upwards: shares can&rsquo;t go below zero, so the random moves
          push small parties up more than down. A party with no votes at all in a province stays at zero there.
        </li>
        <li>
          Each province file lists only that province&rsquo;s top 13 parties. Where a nationally listed party was folded
          into &ldquo;other&rdquo; in a province, we estimate its votes there from its national total, taken from that
          province&rsquo;s &ldquo;other&rdquo; row. The national file and the province files are published a few minutes
          apart.
        </li>
      </ul>

      <H id="seats">Council seats</H>
      <p>
        Once the IEC declares a council, we show its real seat numbers. While a council is still counting, we model them.
      </p>
      <p>
        South African councils use a mixed system. Wards elect councillors directly; PR seats are then shared out so that,
        overall, each party&rsquo;s seats match its share of the ward and PR votes together. A party that wins more wards
        than its share keeps them. That is the formula in Schedule 1 of the Municipal Structures Act.
      </p>
      <p>
        By default we use a simpler approximation: the PR-ballot votes counted so far, shared out over all the
        council&rsquo;s seats with a Droop quota and largest remainders. On the three declared councils we test against, it
        is never more than one seat out for any party. We have also implemented the Schedule 1 formula itself, which
        reproduces those councils exactly; it can be switched on with a setting, and we will make it the default once it
        has been checked against more declared councils.
      </p>
      <p>
        Modelled seat ranges come from 2,000 simulations of the uncounted vote in that council, using the same random moves
        as the projection.
      </p>

      <H id="coalitions">Coalition arithmetic</H>
      <p>
        The calculator adds up seats. It says which combinations of parties hold enough seats between them (half the seats,
        rounded down, plus one). It says nothing about whether those parties would work together, and it is not a
        prediction of who will govern.
      </p>
      <p>
        The list shows <em>minimal winning combinations</em>: up to four of the ten largest parties, reaching the majority
        line, where dropping any one member would fall short. Independent councillors are left out of the list because each
        votes individually. While a council is counting, the percentage is the share of seat simulations in which the
        combination still reaches the line.
      </p>

      <H id="swing">Change since 2021</H>
      <p>
        Ward boundaries were redrawn for 2026, so a 2026 ward and the 2021 ward with the same number can cover different
        areas. Instead of comparing wards, we compare <em>voting districts</em>, which mostly keep their numbers. For each
        ward we take the voting districts that have reported in 2026 and also existed in 2021, and compare each
        party&rsquo;s share across exactly that set in both years. That redraws 2021 on the 2026 boundaries, and stays
        like-for-like while counting is still going on.
      </p>
      <ul>
        <li>Shares are of all valid votes, ward and PR ballots together: the only party breakdown the IEC publishes per voting district.</li>
        <li>Each comparison says how much of the counted vote it covers. Wards where less than 60% can be matched are left out of the &ldquo;biggest swings&rdquo; list.</li>
        <li>&ldquo;Votes needed&rdquo; uses the ward ballot: the runner-up needed the margin plus one more votes, or half the margin plus one voters switching from the leader.</li>
        <li>Turnout is not shown per ward: the IEC results files do not include registered voters per ward.</li>
      </ul>

      <H id="maps">Maps</H>
      <p>
        Boundaries come from the IEC&rsquo;s results map (Municipal Demarcation Board boundaries, 2026 wards), simplified so
        the whole country loads quickly on a phone. Councils are coloured by their largest party once declared, or the party
        leading on votes while counting (pale), with hung councils hatched. Colour is never the only cue: every shape has a
        text label, and the same information is in the council list.
      </p>
      <p>
        Town and suburb names on the ward maps come from GeoNames (geonames.org, CC BY 4.0). Where names would overlap,
        the better-known place is shown; you can hide them, or show ward numbers instead.
      </p>

      <H id="ai">The AI analyst</H>
      <p>
        Where it is switched on, the Ask page sends your question, with the figures this site is showing, to an AI model
        (Claude, by Anthropic). It is instructed to use only those figures, to say when they don&rsquo;t answer the question,
        and not to predict results or take sides. It can still make mistakes, so check any number against the relevant
        page. Questions are not stored with anything that identifies you.
      </p>

      <H id="privacy">Privacy</H>
      <p>
        {APP_NAME} has no accounts and sets no cookies. Where analytics are switched on, we count page views with
        Cloudflare Web Analytics, which uses no cookies and does not track individuals across sites.
      </p>

      <H id="neutrality">Neutrality</H>
      <p>
        {APP_NAME} is non-commercial and has no party affiliation. Party colours follow each party&rsquo;s usual colour
        where there is one, adjusted so they can be told apart and read in light and dark mode; every coloured mark is
        labelled with the party&rsquo;s name. Parties are ordered by votes or seats, never by any other judgement.
      </p>

      <H id="attribution">Attribution</H>
      <p>
        Source: Electoral Commission of South Africa (IEC), public results dashboard data. Provisional until declared.
        Boundaries: IEC / Municipal Demarcation Board. Place names: GeoNames, CC BY 4.0.{" "}
        {APP_NAME} is not affiliated with the IEC. Questions about official results should go to the IEC.
      </p>
      <p className="text-ink-2">
        <Link href="/" className="underline">Back to the count</Link>
      </p>
    </article>
  );
}
