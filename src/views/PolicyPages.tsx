import React from 'react';
import { Link } from 'react-router-dom';

const pageShellClass =
  'min-h-[60vh] bg-zinc-50 dark:bg-[#0a0a0a] text-zinc-800 dark:text-zinc-200 px-4 py-12 sm:px-6 lg:px-8';

const contentClass =
  'mx-auto max-w-4xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/80 p-6 shadow-sm sm:p-8';

const headingClass = 'text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white';
const metaClass = 'mt-3 text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400';
const paragraphClass = 'text-sm leading-7 text-zinc-700 dark:text-zinc-300';
const listClass = 'space-y-3 text-sm leading-7 text-zinc-700 dark:text-zinc-300';

export const TermsPage: React.FC = () => (
  <div className={pageShellClass}>
    <div className={contentClass}>
      <div className={metaClass}>Terms of Service</div>
      <h1 className={`${headingClass} mt-2`}>Terms of Service</h1>
      <p className={`${paragraphClass} mt-4`}><strong>Last Updated:</strong> September 2026</p>

      <p className={`${paragraphClass} mt-6`}>
        Welcome to SkillForge Code, an academic coding and assessment platform developed to help students learn, practice, and improve their programming skills.
      </p>
      <p className={`${paragraphClass} mt-4`}>
        By accessing or using SkillForge Code, you agree to follow these Terms of Service.
      </p>

      <div className="mt-8 space-y-8">
        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">1. Platform Usage</h2>
          <p className={paragraphClass}>SkillForge Code is intended for educational purposes, including coding practice, quizzes, assessments, competitions, and academic activities.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">2. Student Accounts</h2>
          <p className={paragraphClass}>Users are responsible for maintaining the security of their login credentials and for all activity performed through their account.</p>
          <p className={`${paragraphClass} mt-2`}>Users must provide accurate information when required and must not use another student's account.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">3. Coding Submissions</h2>
          <p className={paragraphClass}>Students may submit programs for evaluation through the platform. Submissions may be tested against predefined test cases and system constraints.</p>
          <p className={`${paragraphClass} mt-2`}>Users must not attempt to manipulate the judging system, test cases, execution environment, or platform infrastructure.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">4. Academic Integrity</h2>
          <p className={paragraphClass}>Students are expected to complete assessments and competitions honestly.</p>
          <p className={`${paragraphClass} mt-2`}>Unauthorized collaboration, impersonation, plagiarism, or submission of another person's work may result in disqualification or appropriate academic action.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">5. Platform Availability</h2>
          <p className={paragraphClass}>SkillForge Code may occasionally be unavailable because of maintenance, technical issues, network problems, or infrastructure failures.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">6. Prohibited Activities</h2>
          <ul className={listClass}>
            <li>• Attempt unauthorized access to the platform</li>
            <li>• Attack or disrupt platform services</li>
            <li>• Upload malicious software or harmful code</li>
            <li>• Attempt to bypass authentication or security controls</li>
            <li>• Manipulate scores, rankings, submissions, or test results</li>
            <li>• Abuse the coding execution environment</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">7. Intellectual Property</h2>
          <p className={paragraphClass}>The SkillForge Code platform, its design, branding, content, and software are protected by applicable intellectual property laws.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">8. Changes</h2>
          <p className={paragraphClass}>SkillForge may update these Terms of Service when necessary. Continued use of the platform after changes means that the updated terms apply.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">9. Contact</h2>
          <p className={paragraphClass}>For technical or platform-related concerns, contact the SkillForge Team through the official academic support channels.</p>
        </section>
      </div>

      <p className="mt-8 text-sm font-medium text-zinc-600 dark:text-zinc-400">© 2026 SkillForge Code</p>

      <div className="mt-8">
        <Link to="/" className="inline-flex items-center rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors">
          Back to Home
        </Link>
      </div>
    </div>
  </div>
);

export const SecurityPage: React.FC = () => (
  <div className={pageShellClass}>
    <div className={contentClass}>
      <div className={metaClass}>Security Sandbox Rules</div>
      <h1 className={`${headingClass} mt-2`}>Security Sandbox Rules</h1>
      <p className={`${paragraphClass} mt-4`}><strong>Last Updated:</strong> September 2026</p>

      <p className={`${paragraphClass} mt-6`}>
        SkillForge Code executes student programs inside a controlled sandbox environment designed to protect the platform, infrastructure, and other users.
      </p>

      <div className="mt-8 space-y-8">
        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">1. Code Execution</h2>
          <p className={paragraphClass}>Submitted programs are executed in an isolated environment with predefined resource limits.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">2. Resource Limits</h2>
          <p className={paragraphClass}>Programs may be restricted by:</p>
          <ul className={`${listClass} mt-2`}>
            <li>• Execution time</li>
            <li>• Memory usage</li>
            <li>• CPU usage</li>
            <li>• Output size</li>
            <li>• Process limits</li>
          </ul>
          <p className={`${paragraphClass} mt-2`}>Programs exceeding these limits may be terminated automatically.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">3. File System</h2>
          <p className={paragraphClass}>Programs must operate only within the permitted execution environment.</p>
          <p className={`${paragraphClass} mt-2`}>Attempts to access system files, host files, credentials, or restricted directories are prohibited.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">4. Network Access</h2>
          <p className={paragraphClass}>Unnecessary external network access is restricted.</p>
          <p className={`${paragraphClass} mt-2`}>Programs must not attempt to access internal services, private systems, or unauthorized external resources.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">5. System Access</h2>
          <ul className={listClass}>
            <li>• Privilege escalation</li>
            <li>• Sandbox escape attempts</li>
            <li>• Accessing host operating system resources</li>
            <li>• Reading environment secrets or credentials</li>
            <li>• Executing unauthorized system processes</li>
            <li>• Attacking platform infrastructure</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">6. Malicious Code</h2>
          <p className={paragraphClass}>Do not submit code designed to:</p>
          <ul className={`${listClass} mt-2`}>
            <li>• Damage infrastructure</li>
            <li>• Disrupt services</li>
            <li>• Delete or modify platform data</li>
            <li>• Steal information</li>
            <li>• Attack other users</li>
            <li>• Bypass security controls</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">7. Competition Integrity</h2>
          <p className={paragraphClass}>Attempts to manipulate the judge, hidden test cases, rankings, timers, or scoring mechanisms are prohibited.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">8. Automatic Termination</h2>
          <p className={paragraphClass}>The platform may automatically terminate programs that exceed resource limits or violate execution rules.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">9. Security Monitoring</h2>
          <p className={paragraphClass}>Execution activity may be logged and monitored for platform security, debugging, abuse prevention, and academic integrity.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">10. Reporting Security Issues</h2>
          <p className={paragraphClass}>If you discover a genuine security vulnerability, do not attempt to exploit it. Report it to the SkillForge Team through the appropriate support channel.</p>
        </section>
      </div>

      <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 dark:border-amber-900/60 dark:bg-amber-950/20">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">⚠️ IMPORTANT</p>
        <p className={`${paragraphClass} mt-2`}>
          Never submit passwords, API keys, tokens, personal credentials, or other sensitive information in your code.
        </p>
        <p className={`${paragraphClass} mt-2`}>
          SkillForge Code is designed to provide a safe and fair environment for learning, coding, and competition.
        </p>
      </div>

      <p className="mt-8 text-sm font-medium text-zinc-600 dark:text-zinc-400">© 2026 SkillForge Code</p>

      <div className="mt-8">
        <Link to="/" className="inline-flex items-center rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors">
          Back to Home
        </Link>
      </div>
    </div>
  </div>
);

export const AboutPage: React.FC = () => (
  <div className={pageShellClass}>
    <div className={contentClass}>
      <div className={metaClass}>About SkillForge</div>
      <h1 className={`${headingClass} mt-2`}>SkillForge Team</h1>
      <p className={`${paragraphClass} mt-6`}>
        SkillForge Code is a modern academic coding platform built to help students learn, practice, compete, and build confidence in computer science and data-driven problem solving.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/problems" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors">Explore Problems</Link>
        <Link to="/quizzes" className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Browse Quizzes</Link>
      </div>
    </div>
  </div>
);

export const DepartmentPage: React.FC = () => (
  <div className={pageShellClass}>
    <div className={contentClass}>
      <div className={metaClass}>Academic Department</div>
      <h1 className={`${headingClass} mt-2`}>Department of Data Science</h1>
      <p className={`${paragraphClass} mt-6`}>
        The Department of Data Science empowers students to think critically, build data-driven systems, and evolve into highly capable engineers and researchers through practical coding and applied intelligence.
      </p>
      <div className="mt-6">
        <Link to="/" className="inline-flex items-center rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors">
          Return Home
        </Link>
      </div>
    </div>
  </div>
);
