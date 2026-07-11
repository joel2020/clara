// A shared, non-interactive visual field behind every route. It gives Clara a
// recognizable world without competing with the actual learning controls.
export function AppAtmosphere() {
  return (
    <div className="app-atmosphere" aria-hidden>
      <span className="app-atmosphere__aurora app-atmosphere__aurora--one" />
      <span className="app-atmosphere__aurora app-atmosphere__aurora--two" />
      <span className="app-atmosphere__grid" />
      <span className="app-atmosphere__spark app-atmosphere__spark--one">✦</span>
      <span className="app-atmosphere__spark app-atmosphere__spark--two">✦</span>
      <span className="app-atmosphere__spark app-atmosphere__spark--three">✦</span>
    </div>
  );
}
