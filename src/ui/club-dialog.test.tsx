import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TEST_CAREER, testPlayer } from "../logic/test-support/player-fixtures.ts";
import { ClubView } from "./club-dialog.tsx";

/** A player of club 5 with `overall` at every code but `best` at `code`. */
const squadPlayer = (id: number, name: string, code: number, best: number) =>
  testPlayer({
    id,
    name,
    clubId: 5,
    overallByCode: Array.from({ length: 32 }, (_, at) => (at === code ? best : 40)),
  });

const PLAYERS = [
  squadPlayer(1, "Bramkarz", 0, 80),
  squadPlayer(2, "Obrońca", 5, 75),
  squadPlayer(3, "Napastnik", 30, 72),
  // Not at the club: never in its eleven.
  testPlayer({
    id: 4,
    name: "Obcy",
    clubId: 9,
    overallByCode: Array.from({ length: 32 }, () => 99),
  }),
];

const render = (formationCodes: readonly number[]) =>
  renderToStaticMarkup(
    <ClubView
      players={PLAYERS}
      myTeamId={5}
      career={{
        ...TEST_CAREER,
        formationCodes,
        formations: [
          [0, 5, 5],
          [0, 5, 30],
        ],
      }}
      showPotential={false}
      positionName={(code) => `P${String(code)}`}
      dispatch={() => undefined}
    />,
  );

describe("the club dialog", () => {
  it("ranks the formations by their best eleven, the club's marked, with the difference to it", () => {
    const html = render([0, 5, 5]);
    // [0, 5, 30] is "1-1" (a defender, a forward): 80, 75, 72; the club's [0, 5, 5] is "2": 80, 75, 40.
    expect(html).toMatch(/1-1<\/button>.*75,7.*\+10,7.*\(obecna\)<\/button>.*65,0.*0,0/u);
  });

  it("lists the best formation's eleven when the club's is not among them, outsiders left out", () => {
    const html = render([0, 3, 30]);
    expect(html).toContain("Jedenastka: 1-1");
    expect(html).toMatch(/P0<\/span>.*Bramkarz.*P5<\/span>.*Obrońca.*P30<\/span>.*Napastnik/u);
    expect(html).not.toContain("Obcy");
    // The outfield positions under each name tell apart formations of one name.
    expect(html).toContain('<span class="formation-codes">P5 P30</span>');
  });

  it("shows no difference without the club's formation among them", () => {
    expect(render([0, 3, 30])).toMatch(/<td>–<\/td>/u);
  });

  // Owner, 2026-11-14 (roadmap 126): the eleven above the table, the club's formation first, its
  // positions in the game's order, from the goalkeeper and the right side.
  it("shows the club's formation's eleven first, above the table", () => {
    const html = render([0, 5, 5]);
    expect(html).toContain("Jedenastka: 2");
    expect(html.indexOf("Jedenastka")).toBeLessThan(html.indexOf("<table"));
  });

  it("names a formation's positions by code, the right side first", () => {
    const html = renderToStaticMarkup(
      <ClubView
        players={[squadPlayer(1, "Bramkarz", 0, 80)]}
        myTeamId={5}
        career={{ ...TEST_CAREER, formationCodes: [0, 7, 3], formations: [[0, 7, 3]] }}
        showPotential={false}
        positionName={(code) => `P${String(code)}`}
        dispatch={() => undefined}
      />,
    );
    expect(html).toContain('<span class="formation-codes">P3 P7</span>');
    expect(html).toMatch(/P0<\/span>.*P3<\/span>.*P7<\/span>/u);
  });

  // Owner, 2026-11-14 (roadmap 129): the squad players the eleven leaves out, under it.
  it("lists the substitutes under the eleven, outsiders left out, or says the squad fits", () => {
    const html = renderToStaticMarkup(
      <ClubView
        players={PLAYERS}
        myTeamId={5}
        career={{ ...TEST_CAREER, formationCodes: [0, 30], formations: [[0, 30]] }}
        showPotential={false}
        positionName={(code) => `P${String(code)}`}
        dispatch={() => undefined}
      />,
    );
    expect(html).toMatch(/Jedenastka.*Napastnik.*Zmiennicy.*Obrońca.*<table/u);
    expect(html).not.toContain("Obcy");
    expect(render([0, 5, 30])).toContain("Cały skład mieści się w");
  });
});
