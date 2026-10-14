// Roles, most recent first. Wording follows the October 2026 content brief and résumé
// (public/Karthik_Sengupta_Resume.pdf). The student council entry keeps its earlier role
// underneath, as before.

export const experience = [
  {
    id: 'ta',
    role: 'Graduate Teaching Assistant, Program Design Paradigms (CS 5010)',
    org: 'Khoury College, Northeastern University',
    dates: 'Sep 2026 – present',
    points: [
      'Review student code for design quality and test rigor (JUnit 5, JaCoCo, PIT mutation testing) in a graduate Java course on object-oriented design.',
      'Run labs and office hours, and debug build and toolchain failures across Gradle, IntelliJ, and the JDK.',
    ],
  },
  {
    id: 'gsm',
    role: 'Global Student Mentor',
    org: 'Office of Global Services, Northeastern University',
    dates: 'Aug 2026 – present',
    points: [
      'Selected through a competitive multi-round process to mentor a cohort of incoming international students through small-group sessions and monthly meetups.',
    ],
  },
  {
    id: 'kmsc',
    role: 'President',
    org: 'Khoury Masters Student Council, Northeastern University',
    dates: 'Apr 2026 – present',
    points: ['Leads governance for 150+ MS students, wrote the founding constitution, and moved the council to a formal election model.'],
    earlier: {
      role: 'Treasurer',
      dates: 'Dec 2025 – Mar 2026',
      points: ['Managed the council budget and supported 5+ events a semester. Before that: Event Coordinator.'],
    },
  },
  {
    id: 'iitd',
    role: 'Research Intern',
    org: 'National Center for Assistive Health Technology, IIT Delhi',
    dates: 'Jun – Jul 2024',
    points: [
      'Designed, built, and deployed an AI application (OpenCV + LLM APIs) end to end for 200+ users across 8 sites, reaching 82% accuracy validated by domain specialists.',
      'Engineered Python pipelines and Flask REST APIs supporting concurrent multi-site access, cutting manual effort by 65%.',
    ],
  },
  {
    id: 'ltim',
    role: 'Software Development Engineer Intern',
    org: 'LTIMindtree, Chennai',
    dates: 'Aug – Oct 2023',
    points: [
      'Owned the employee onboarding and offboarding database end to end, from design through maintenance, and built the Power BI observability dashboards on top of it, replacing 15+ hours a month of manual reporting.',
      'Contributed SQL ingestion and automation improvements within the team’s existing microservices platform, part of an effort that automated 500+ lifecycle events and cut onboarding time by 35%.',
    ],
  },
]
