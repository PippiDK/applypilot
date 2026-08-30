import styles from './help.module.css'

export const metadata={
  title:'Help · ApplyPilot',
  description:'ApplyPilot user manual and quick start guide'
}

const quickSteps=[
  ['1','Load your CVs','Open Search Profile and add up to three ready CVs to the CV Library.'],
  ['2','Build the Search Profile','Review primary roles, adjacent roles, locations, work models and exclusions, then save the profile.'],
  ['3','Choose freshness','Select 1, 3, 7 or 14 days under Posted Within.'],
  ['4','Search LinkedIn','Run the search. ApplyPilot reads public LinkedIn vacancies and returns the worthwhile matches it found.'],
  ['5','Review the shortlist','Use Filters, status controls and the vacancy panel to decide which roles deserve attention.'],
  ['6','Compare CV and job','Run Expertise Match, then Find best CV when more than one CV is ready.'],
  ['7','Adapt and export','Run CV Adaptation, review every suggested change, pass Truth Guard and download the tailored DOCX.']
]

const sections=[
  {
    id:'search-profile',
    kicker:'SETUP',
    title:'Search Profile',
    body:'The Search Profile tells ApplyPilot what to search for. It is the source of truth for role directions and job-search preferences.',
    bullets:[
      'Primary roles are your main search directions.',
      'Adjacent roles expand discovery without replacing the primary roles.',
      'Locations and work models define where you are willing to work.',
      'Exclusions help remove clearly unwanted job families or patterns.',
      'Save the profile before running a new search so the current choices are used.'
    ]
  },
  {
    id:'cv-library',
    kicker:'SETUP',
    title:'CV Library',
    body:'The CV Library holds the source CVs ApplyPilot is allowed to use. A source CV stays unchanged; vacancy-specific versions are derived from it.',
    bullets:[
      'You can keep up to three CVs ready.',
      'Each CV is parsed and kept as its own source. CVs are never merged.',
      'The primary CV supports profile building and remains a separate source document.',
      'Replacing a CV creates a new source version so stale adaptation results are not reused.'
    ]
  },
  {
    id:'search-filters',
    kicker:'SEARCH',
    title:'Search & Filters',
    body:'Posted Within controls the LinkedIn freshness window. Filters work on the result list after the search has returned jobs.',
    bullets:[
      'Choose 1, 3, 7 or 14 days, then press Search LinkedIn.',
      'The search summary shows jobs discovered, full JDs read and worthwhile jobs evaluated.',
      'Use Search Areas and Work Model filters to narrow the current result list.',
      'All filters restores the complete current shortlist. Filters do not rewrite the Search Profile.'
    ]
  },
  {
    id:'vacancy-review',
    kicker:'REVIEW',
    title:'Vacancy review',
    body:'Select a vacancy in Live matches to open its review panel. The left list is for triage; the right panel is for evidence and action.',
    bullets:[
      'High, Medium and Low describe search relevance for the returned vacancy.',
      'Area, employment type and work model are shown separately from professional expertise.',
      'Open LinkedIn vacancy takes you to the public job page.',
      'Use Status to keep track of your own decision or application state.'
    ]
  },
  {
    id:'expertise-match',
    kicker:'COMPARE',
    title:'Expertise Match',
    body:'Expertise Match compares the full job description with the selected source CV for professional evidence only.',
    bullets:[
      'Location, salary, commute, work model and posting date are not part of the expertise score.',
      'Matched means the Source CV contains supporting evidence.',
      'Partial means related evidence exists but does not fully cover the requirement.',
      'Not evidenced means the requirement is not supported by the Source CV; it does not claim that the candidate lacks the skill.'
    ]
  },
  {
    id:'best-cv',
    kicker:'COMPARE',
    title:'Best CV',
    body:'Find best CV compares the ready CVs for the selected vacancy and recommends the strongest source for adaptation.',
    bullets:[
      'The comparison uses each CV independently.',
      'No content is copied from one CV into another.',
      'You can keep the recommended CV or deliberately choose another ready CV before adaptation.'
    ]
  },
  {
    id:'adaptation',
    kicker:'TAILOR',
    title:'CV Adaptation',
    body:'CV Adaptation creates a vacancy-specific derived version. It does not edit the stored Source CV.',
    bullets:[
      'Only the approved adaptation blocks are changed: Professional Summary and the overviews of the two most recent roles.',
      'Review every proposed change against the original text.',
      'Choose Accept or Keep for every block. Keep leaves the Source CV wording unchanged.',
      'You may edit an AI suggestion before accepting it, but the final text still has to pass evidence checks.'
    ]
  },
  {
    id:'truth-guard',
    kicker:'SAFETY',
    title:'Truth Guard',
    body:'Truth Guard is the factual gate between AI suggestions and a ready tailored CV.',
    bullets:[
      'Unsupported metrics, achievements or responsibilities must not be introduced.',
      'Evidence for a role must come from that role when adapting a role overview.',
      'A CV is only ready when the selected job, CV and source version still match and all review decisions are complete.'
    ]
  },
  {
    id:'download',
    kicker:'EXPORT',
    title:'Download tailored CV',
    body:'When the adaptation is ready, attach the matching source DOCX and let ApplyPilot create the vacancy-specific document.',
    bullets:[
      'Use the DOCX that corresponds to the selected Source CV.',
      'Only accepted replacements are written into the export.',
      'The original source file remains unchanged.'
    ]
  }
]

export default function HelpPage(){
  return <main className={styles.page}>
    <header className={styles.hero}>
      <p className={styles.eyebrow}>APPLYPILOT · HELP</p>
      <h1>From search profile to tailored CV.</h1>
      <p className={styles.lede}>A practical user manual for the complete ApplyPilot MVP flow. Start with Quick start, then use the detailed sections when you need them.</p>
      <nav className={styles.jump} aria-label="Help sections">
        <a href="#quick-start">Quick start</a>
        <a href="#search-profile">Search Profile</a>
        <a href="#search-filters">Search & Filters</a>
        <a href="#vacancy-review">Vacancy review</a>
        <a href="#adaptation">CV Adaptation</a>
        <a href="#troubleshooting">Troubleshooting</a>
      </nav>
    </header>

    <section id="quick-start" className={styles.section}>
      <div className={styles.sectionHead}><p className={styles.eyebrow}>START HERE</p><h2>Quick start</h2><p>Seven steps cover the normal end-to-end workflow.</p></div>
      <div className={styles.steps}>{quickSteps.map(([number,title,text])=><article className={styles.step} key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
    </section>

    <section className={styles.screenshotSection} aria-labelledby="results-example">
      <div className={styles.sectionHead}><p className={styles.eyebrow}>CURRENT MVP</p><h2 id="results-example">Search results and vacancy review</h2><p>The shortlist stays on the left; the selected vacancy, conditions, Expertise Match and CV actions stay on the right.</p></div>
      <figure className={styles.figure}>
        <img src="/help/applypilot-live-results.webp" alt="ApplyPilot Live matches list and selected vacancy review panel"/>
        <figcaption>Example of the current V16 result-review workspace. Additional screenshots can be added to this Help page as the walkthrough evolves.</figcaption>
      </figure>
    </section>

    <section className={styles.manualGrid} aria-label="Detailed user manual">
      {sections.map(section=><article id={section.id} className={styles.card} key={section.id}>
        <p className={styles.eyebrow}>{section.kicker}</p>
        <h2>{section.title}</h2>
        <p>{section.body}</p>
        <ul>{section.bullets.map(item=><li key={item}>{item}</li>)}</ul>
      </article>)}
    </section>

    <section id="environments" className={styles.section}>
      <div className={styles.sectionHead}><p className={styles.eyebrow}>ENVIRONMENTS</p><h2>LIVE vs TEST</h2><p>The application behavior is the same product flow, but authentication and release purpose are different.</p></div>
      <div className={styles.environmentGrid}>
        <article><strong>LIVE</strong><h3>Stable product</h3><p>Use LIVE for the real production experience. Authentication is enabled and sign-in uses the invite-only email magic-link flow.</p></article>
        <article><strong>TEST</strong><h3>Working preview</h3><p>Use TEST for tuning and verification before the next release. Preview authentication is bypassed so you can open the app directly.</p></article>
        <article><strong>BASELINE</strong><h3>Frozen comparison</h3><p>The old pre-MVP LIVE is kept only as a visual and behavioral reference. Do not develop new features there.</p></article>
      </div>
    </section>

    <section id="troubleshooting" className={styles.section}>
      <div className={styles.sectionHead}><p className={styles.eyebrow}>WHEN SOMETHING LOOKS WRONG</p><h2>Troubleshooting</h2></div>
      <div className={styles.troubleshooting}>
        <article><h3>LIVE sends me to Sign in</h3><p>That is expected when there is no valid production session. Request a new magic link and open it in the same browser.</p></article>
        <article><h3>TEST asks for a magic link</h3><p>Make sure you are using the TEST preview URL rather than the production LIVE URL.</p></article>
        <article><h3>No jobs appear</h3><p>Check that a Search Profile is saved, a CV is ready, the freshness window is appropriate and the current filters are not hiding all results.</p></article>
        <article><h3>Expertise Match or adaptation is stale</h3><p>Re-select the vacancy and source CV. Replacing a source CV creates a new version and old derived results must not be reused.</p></article>
        <article><h3>Tailored DOCX will not export</h3><p>Confirm that all adaptation decisions are complete and that the attached DOCX matches the selected Source CV.</p></article>
        <article><h3>A suggestion is not supported by the CV</h3><p>Do not accept it. Keep the original wording or edit the suggestion so it is fully supported by the Source CV.</p></article>
      </div>
    </section>

    <footer className={styles.footer}><a href="/">← Back to ApplyPilot</a><span>ApplyPilot · Search less. Apply better.</span></footer>
  </main>
}
