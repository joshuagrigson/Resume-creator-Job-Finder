/**
 * Skill dictionary, keyword extraction and requirement splitting.
 *
 * Shared by the browser app and the API server — dependency-free (no DOM, no Node APIs,
 * no imports outside `shared/`).
 *
 * Ambiguity policy
 * ----------------
 * A handful of skill names are ordinary English words ("go", "excel", "react", "word",
 * "access", "epic", "sketch", "lean", …). Matching them blindly produces nonsense such as
 * "go to the store" → Go. Each of those aliases carries a rule in {@link AMBIGUOUS_ALIASES}:
 *
 *  - `near`  — at least one of these tokens must appear within `window` tokens on either
 *              side (e.g. "go" only counts next to golang / programming / backend …);
 *  - `notFollowedBy` — the alias is rejected when the next token is one of these
 *              (e.g. "excel at communication" is the verb, not the spreadsheet).
 *
 * The unambiguous spelling always works regardless of context ("golang", "Microsoft Excel",
 * "React.js"). When a user lists a term explicitly as a skill, {@link canonicalSkillFor}
 * bypasses the rules — an explicit "Go" in a skills section is the language.
 */

import {
  JOB_AD_STOPWORDS,
  STOPWORDS,
  isNoiseToken,
  isNumericToken,
  normalizeText,
  stripHtml,
  tokenizeAll,
  tokenizeNormalized,
} from './text';

export type SkillCategory =
  | 'language'
  | 'framework'
  | 'tool'
  | 'cloud'
  | 'data'
  | 'design'
  | 'marketing'
  | 'sales'
  | 'ops'
  | 'soft'
  | 'finance'
  | 'healthcare'
  | 'trades'
  | 'other';

export interface SkillEntry {
  canonical: string;
  aliases: string[];
  category: SkillCategory;
}

/** Terse constructor so the table below stays readable. */
function s(canonical: string, category: SkillCategory, aliases: string[] = []): SkillEntry {
  return { canonical, category, aliases };
}

// ---------------------------------------------------------------------------
// The dictionary
// ---------------------------------------------------------------------------

const LANGUAGES: SkillEntry[] = [
  s('JavaScript', 'language', ['js', 'java script', 'ecmascript', 'es6']),
  s('TypeScript', 'language', ['ts', 'type script']),
  s('Python', 'language', ['python3']),
  s('Java', 'language', ['java se', 'java ee', 'j2ee']),
  s('C++', 'language', ['cpp', 'c plus plus']),
  s('C#', 'language', ['csharp', 'c sharp']),
  s('C', 'language', ['c programming', 'c language']),
  s('Go', 'language', ['golang', 'go lang']),
  s('Rust', 'language', []),
  s('Ruby', 'language', []),
  s('PHP', 'language', []),
  s('Swift', 'language', []),
  s('Kotlin', 'language', []),
  s('Objective-C', 'language', ['objective c', 'objc']),
  s('Scala', 'language', []),
  s('R', 'language', ['r programming', 'r language']),
  s('MATLAB', 'language', []),
  s('Perl', 'language', []),
  s('Dart', 'language', []),
  s('Elixir', 'language', []),
  s('Erlang', 'language', []),
  s('Haskell', 'language', []),
  s('Clojure', 'language', []),
  s('F#', 'language', ['fsharp', 'f sharp']),
  s('Groovy', 'language', []),
  s('Lua', 'language', []),
  s('Bash', 'language', ['bash scripting']),
  s('PowerShell', 'language', ['power shell']),
  s('Shell Scripting', 'language', ['shell', 'shell scripts', 'unix shell']),
  s('SQL', 'language', ['structured query language']),
  s('PL/SQL', 'language', ['plsql']),
  s('T-SQL', 'language', ['tsql', 'transact sql']),
  s('VBA', 'language', ['visual basic for applications']),
  s('Visual Basic', 'language', ['vb.net', 'vb net']),
  s('COBOL', 'language', []),
  s('Fortran', 'language', []),
  s('Assembly', 'language', ['assembly language', 'assembler']),
  s('Solidity', 'language', []),
  s('Verilog', 'language', ['system verilog']),
  s('VHDL', 'language', []),
  s('HTML', 'language', ['html5']),
  s('CSS', 'language', ['css3']),
  s('Sass', 'language', ['scss']),
  s('XML', 'language', []),
  s('JSON', 'language', []),
  s('YAML', 'language', ['yml']),
  s('GraphQL', 'language', ['graph ql']),
  s('Regular Expressions', 'language', ['regex', 'regexp']),
  s('.NET', 'framework', ['dotnet', 'dot net', '.net core', '.net framework']),
];

const FRAMEWORKS: SkillEntry[] = [
  s('React', 'framework', ['react.js', 'reactjs']),
  s('React Native', 'framework', ['react-native']),
  s('Next.js', 'framework', ['nextjs', 'next js']),
  s('Vue.js', 'framework', ['vue', 'vuejs']),
  s('Nuxt.js', 'framework', ['nuxt', 'nuxtjs']),
  s('Angular', 'framework', ['angularjs', 'angular.js']),
  s('Svelte', 'framework', ['sveltekit', 'svelte kit']),
  s('jQuery', 'framework', ['j query']),
  s('Redux', 'framework', ['redux toolkit']),
  s('Node.js', 'framework', ['node', 'nodejs']),
  s('Express.js', 'framework', ['expressjs']),
  s('NestJS', 'framework', ['nest.js']),
  s('Deno', 'framework', []),
  s('Django', 'framework', []),
  s('Flask', 'framework', []),
  s('FastAPI', 'framework', ['fast api']),
  s('Ruby on Rails', 'framework', ['rails', 'ror']),
  s('Laravel', 'framework', []),
  s('Symfony', 'framework', []),
  s('CodeIgniter', 'framework', ['code igniter']),
  s('Spring Boot', 'framework', ['springboot', 'spring framework']),
  s('Hibernate', 'framework', []),
  s('ASP.NET', 'framework', ['aspnet', 'asp.net core']),
  s('Blazor', 'framework', []),
  s('Entity Framework', 'framework', ['ef core']),
  s('Xamarin', 'framework', []),
  s('Flutter', 'framework', []),
  s('Ionic', 'framework', []),
  s('SwiftUI', 'framework', ['swift ui']),
  s('UIKit', 'framework', ['ui kit']),
  s('Jetpack Compose', 'framework', ['jetpack']),
  s('Android SDK', 'framework', []),
  s('Electron', 'framework', ['electron.js']),
  s('Tailwind CSS', 'framework', ['tailwind', 'tailwindcss']),
  s('Bootstrap', 'framework', []),
  s('Material UI', 'framework', ['mui', 'material-ui']),
  s('Styled Components', 'framework', ['styled-components']),
  s('Webpack', 'tool', ['web pack']),
  s('Vite', 'tool', []),
  s('Babel', 'tool', []),
  s('ESLint', 'tool', ['es lint']),
  s('Prettier', 'tool', []),
  s('Storybook', 'tool', []),
  s('Three.js', 'framework', ['threejs']),
  s('D3.js', 'framework', ['d3js', 'd3']),
  s('Chart.js', 'framework', ['chartjs']),
  s('Socket.IO', 'framework', ['socketio', 'socket io']),
  s('gRPC', 'framework', ['grpc']),
  s('REST APIs', 'framework', ['rest api', 'restful api', 'restful apis', 'rest', 'restful']),
  s('SOAP', 'framework', ['soap api', 'soap web services']),
  s('WebSockets', 'framework', ['websocket', 'web sockets']),
  s('Microservices', 'framework', ['microservice architecture', 'micro services']),
  s('Serverless', 'cloud', ['serverless architecture']),
  s('OAuth', 'framework', ['oauth2', 'oauth 2.0']),
  s('JWT', 'framework', ['json web token', 'json web tokens']),
  s('WordPress', 'framework', ['word press', 'wp']),
  s('Shopify', 'framework', []),
  s('Drupal', 'framework', []),
  s('Joomla', 'framework', []),
  s('Magento', 'framework', []),
  s('Webflow', 'framework', ['web flow']),
  s('Squarespace', 'framework', ['square space']),
  s('Wix', 'framework', []),
];

const CLOUD_DEVOPS: SkillEntry[] = [
  s('AWS', 'cloud', ['amazon web services']),
  s('Amazon S3', 'cloud', ['s3']),
  s('AWS Lambda', 'cloud', ['lambda functions']),
  s('Amazon EC2', 'cloud', ['ec2']),
  s('Amazon RDS', 'cloud', ['rds']),
  s('DynamoDB', 'cloud', ['dynamo db']),
  s('CloudFormation', 'cloud', ['cloud formation']),
  s('Microsoft Azure', 'cloud', ['azure']),
  s('Azure DevOps', 'cloud', ['vsts']),
  s('Google Cloud Platform', 'cloud', ['gcp', 'google cloud']),
  s('BigQuery', 'data', ['big query']),
  s('Firebase', 'cloud', []),
  s('Cloudflare', 'cloud', ['cloud flare']),
  s('Cloudflare Workers', 'cloud', ['cf workers']),
  s('Vercel', 'cloud', []),
  s('Netlify', 'cloud', []),
  s('Heroku', 'cloud', []),
  s('DigitalOcean', 'cloud', ['digital ocean']),
  s('Docker', 'cloud', ['containerization', 'containers']),
  s('Kubernetes', 'cloud', ['k8s', 'kubernetes cluster']),
  s('Helm', 'cloud', []),
  s('OpenShift', 'cloud', ['open shift']),
  s('Terraform', 'cloud', []),
  s('Pulumi', 'cloud', []),
  s('Ansible', 'cloud', []),
  s('Vagrant', 'cloud', []),
  s('Jenkins', 'cloud', []),
  s('CircleCI', 'cloud', ['circle ci']),
  s('Travis CI', 'cloud', ['travisci']),
  s('GitHub Actions', 'cloud', ['github action']),
  s('GitLab CI', 'cloud', ['gitlab ci/cd']),
  s('CI/CD', 'cloud', ['ci cd', 'continuous integration', 'continuous delivery', 'continuous deployment']),
  s('Git', 'tool', ['version control']),
  s('GitHub', 'tool', ['git hub']),
  s('GitLab', 'tool', ['git lab']),
  s('Bitbucket', 'tool', ['bit bucket']),
  s('Subversion', 'tool', ['svn']),
  s('Linux', 'cloud', ['ubuntu', 'centos', 'red hat enterprise linux', 'rhel', 'debian']),
  s('Unix', 'cloud', []),
  s('Windows Server', 'cloud', ['active directory']),
  s('macOS', 'cloud', ['mac os']),
  s('Nginx', 'cloud', []),
  s('Apache HTTP Server', 'cloud', ['apache httpd']),
  s('Apache Kafka', 'data', ['kafka']),
  s('RabbitMQ', 'data', ['rabbit mq']),
  s('Redis', 'data', []),
  s('Elasticsearch', 'data', ['elastic search', 'elk stack', 'opensearch']),
  s('Prometheus', 'cloud', []),
  s('Grafana', 'cloud', []),
  s('Datadog', 'cloud', ['data dog']),
  s('New Relic', 'cloud', ['newrelic']),
  s('Splunk', 'cloud', []),
  s('Sentry', 'cloud', []),
  s('PagerDuty', 'cloud', ['pager duty']),
  s('Site Reliability Engineering', 'cloud', ['sre']),
  s('Infrastructure as Code', 'cloud', ['iac']),
  s('Load Balancing', 'cloud', ['load balancer', 'load balancers']),
  s('TCP/IP', 'cloud', ['tcp ip']),
  s('DNS', 'cloud', ['domain name system']),
  s('VPN', 'cloud', ['virtual private network']),
  s('Observability', 'cloud', []),
  s('System Monitoring', 'cloud', ['monitoring and alerting']),
  s('Incident Response', 'cloud', ['incident management', 'on-call rotation']),
  s('Disaster Recovery', 'cloud', ['business continuity']),
  s('High Availability', 'cloud', ['fault tolerance']),
  s('Performance Tuning', 'cloud', ['performance optimization']),
];

const DATA_AI: SkillEntry[] = [
  s('MySQL', 'data', ['my sql', 'mariadb']),
  s('PostgreSQL', 'data', ['postgres', 'postgre sql']),
  s('Microsoft SQL Server', 'data', ['sql server', 'mssql']),
  s('Oracle Database', 'data', ['oracle db', 'oracle database administration']),
  s('MongoDB', 'data', ['mongo db', 'mongo']),
  s('Cassandra', 'data', ['apache cassandra']),
  s('Neo4j', 'data', ['neo 4j']),
  s('SQLite', 'data', ['sq lite']),
  s('Snowflake', 'data', []),
  s('Databricks', 'data', ['data bricks']),
  s('Amazon Redshift', 'data', ['redshift']),
  s('Apache Spark', 'data', ['spark', 'pyspark']),
  s('Hadoop', 'data', ['hdfs', 'mapreduce']),
  s('Apache Hive', 'data', ['hive']),
  s('Apache Airflow', 'data', ['airflow']),
  s('dbt', 'data', ['data build tool']),
  s('ETL', 'data', ['etl pipelines', 'elt', 'extract transform load']),
  s('Data Warehousing', 'data', ['data warehouse']),
  s('Data Modeling', 'data', ['data modelling', 'dimensional modeling']),
  s('Data Engineering', 'data', ['data pipelines']),
  s('Data Analysis', 'data', ['data analytics']),
  s('Data Visualization', 'data', ['data viz', 'dashboarding', 'dashboards']),
  s('Tableau', 'data', []),
  s('Power BI', 'data', ['powerbi', 'microsoft power bi']),
  s('Looker', 'data', []),
  s('Qlik', 'data', ['qlikview', 'qlik sense']),
  s('Looker Studio', 'data', ['google data studio', 'data studio']),
  s('pandas', 'data', []),
  s('NumPy', 'data', ['num py']),
  s('SciPy', 'data', ['sci py']),
  s('scikit-learn', 'data', ['sklearn', 'scikit learn']),
  s('TensorFlow', 'data', ['tensor flow']),
  s('PyTorch', 'data', ['py torch']),
  s('Keras', 'data', []),
  s('Machine Learning', 'data', ['ml', 'machine-learning']),
  s('Deep Learning', 'data', ['neural networks']),
  s('Natural Language Processing', 'data', ['nlp']),
  s('Computer Vision', 'data', ['image recognition']),
  s('Artificial Intelligence', 'data', ['ai']),
  s('Generative AI', 'data', ['gen ai', 'genai', 'generative artificial intelligence']),
  s('Large Language Models', 'data', ['llm', 'llms']),
  s('Prompt Engineering', 'data', []),
  s('MLOps', 'data', ['ml ops']),
  s('Statistics', 'data', ['statistical analysis', 'statistical modeling']),
  s('A/B Testing', 'data', ['a/b test', 'a/b tests', 'ab testing', 'split testing', 'multivariate testing']),
  s('Predictive Modeling', 'data', ['predictive analytics']),
  s('Business Intelligence', 'data', ['bi reporting']),
  s('Jupyter', 'data', ['jupyter notebook', 'jupyter notebooks']),
  s('Big Data', 'data', []),
  s('Data Governance', 'data', []),
  s('Data Quality', 'data', ['data cleansing', 'data cleaning']),
  s('SAS', 'data', []),
  s('SPSS', 'data', []),
  s('Web Scraping', 'data', ['scraping']),
];

const SECURITY: SkillEntry[] = [
  s('Cybersecurity', 'ops', ['cyber security', 'information security', 'infosec']),
  s('Penetration Testing', 'ops', ['pen testing', 'pentest', 'pentesting']),
  s('Vulnerability Management', 'ops', ['vulnerability assessment', 'vulnerability scanning']),
  s('SIEM', 'ops', ['security information and event management']),
  s('SOC 2', 'ops', ['soc2']),
  s('ISO 27001', 'ops', ['iso27001']),
  s('PCI DSS', 'ops', ['pci-dss', 'pci compliance']),
  s('GDPR', 'ops', ['general data protection regulation']),
  s('Identity and Access Management', 'ops', ['iam']),
  s('Single Sign-On', 'ops', ['sso', 'single sign on']),
  s('Encryption', 'ops', ['cryptography']),
  s('Firewalls', 'ops', ['firewall configuration']),
  s('Zero Trust', 'ops', ['zero trust architecture']),
  s('Threat Modeling', 'ops', ['threat analysis']),
  s('Risk Assessment', 'ops', ['risk analysis']),
  s('Regulatory Compliance', 'ops', ['compliance management']),
  s('SOX', 'finance', ['sarbanes-oxley', 'sarbanes oxley']),
  s('Security Awareness Training', 'ops', []),
];

const MOBILE_TESTING: SkillEntry[] = [
  s('iOS Development', 'framework', ['ios', 'iphone development']),
  s('Android Development', 'framework', ['android']),
  s('Mobile App Development', 'framework', ['mobile development', 'mobile apps']),
  s('App Store Optimization', 'marketing', ['aso']),
  s('Unit Testing', 'tool', ['unit tests']),
  s('Integration Testing', 'tool', ['integration tests']),
  s('End-to-End Testing', 'tool', ['e2e testing', 'end to end testing']),
  s('Test Automation', 'tool', ['automated testing', 'automation testing']),
  s('Jest', 'tool', []),
  s('Vitest', 'tool', []),
  s('Mocha', 'tool', ['chai']),
  s('Cypress', 'tool', []),
  s('Playwright', 'tool', []),
  s('Selenium', 'tool', ['selenium webdriver']),
  s('JUnit', 'tool', ['j unit']),
  s('PyTest', 'tool', ['py test']),
  s('Postman', 'tool', []),
  s('Quality Assurance', 'tool', ['qa', 'qa testing']),
  s('Manual Testing', 'tool', []),
  s('Test Cases', 'tool', ['test plans', 'test case design']),
  s('Regression Testing', 'tool', []),
  s('Load Testing', 'tool', ['stress testing']),
  s('Test-Driven Development', 'tool', ['tdd', 'test driven development']),
  s('Behavior-Driven Development', 'tool', ['bdd', 'behavior driven development']),
  s('Bug Tracking', 'tool', ['defect tracking']),
];

const PRODUCT_DESIGN: SkillEntry[] = [
  s('Product Management', 'ops', ['product owner']),
  s('Product Strategy', 'ops', []),
  s('Product Roadmapping', 'ops', ['roadmapping', 'product roadmap', 'roadmap planning']),
  s('User Research', 'design', ['user interviews']),
  s('Usability Testing', 'design', ['user testing']),
  s('Wireframing', 'design', ['wireframes']),
  s('Prototyping', 'design', ['prototypes', 'rapid prototyping']),
  s('UX Design', 'design', ['ux', 'user experience design']),
  s('UI Design', 'design', ['ui', 'user interface design']),
  s('Interaction Design', 'design', []),
  s('Design Systems', 'design', ['design system']),
  s('Figma', 'design', []),
  s('Sketch', 'design', []),
  s('Adobe XD', 'design', ['xd']),
  s('InVision', 'design', ['in vision']),
  s('Framer', 'design', []),
  s('Adobe Photoshop', 'design', ['photoshop']),
  s('Adobe Illustrator', 'design', ['illustrator']),
  s('Adobe InDesign', 'design', ['indesign']),
  s('Adobe Premiere Pro', 'design', ['premiere pro', 'adobe premiere']),
  s('Adobe After Effects', 'design', ['after effects']),
  s('Canva', 'design', []),
  s('Graphic Design', 'design', []),
  s('Typography', 'design', []),
  s('Branding', 'design', ['brand identity']),
  s('Motion Graphics', 'design', ['motion design']),
  s('3D Modeling', 'design', ['3d modelling', '3d design', '3d']),
  s('Blender', 'design', []),
  s('AutoCAD', 'design', ['auto cad']),
  s('SolidWorks', 'design', ['solid works']),
  s('Revit', 'design', []),
  s('SketchUp', 'design', ['sketch up']),
  s('Video Editing', 'design', ['video production']),
  s('Photography', 'design', ['photo editing']),
  s('Accessibility', 'design', ['wcag', 'a11y', 'ada compliance']),
  s('Information Architecture', 'design', []),
  s('Customer Journey Mapping', 'design', ['journey mapping']),
  s('Design Thinking', 'design', []),
];

const MARKETING: SkillEntry[] = [
  s('SEO', 'marketing', ['search engine optimization']),
  s('SEM', 'marketing', ['search engine marketing']),
  s('PPC', 'marketing', ['pay per click', 'pay-per-click', 'paid search']),
  s('Google Ads', 'marketing', ['google adwords', 'adwords']),
  s('Meta Ads', 'marketing', ['facebook ads', 'meta advertising', 'instagram ads']),
  s('LinkedIn Ads', 'marketing', []),
  s('TikTok Ads', 'marketing', []),
  s('Microsoft Ads', 'marketing', ['bing ads']),
  s('Google Analytics', 'marketing', []),
  s('GA4', 'marketing', ['google analytics 4']),
  s('Google Tag Manager', 'marketing', ['gtm', 'tag manager']),
  s('Google Search Console', 'marketing', ['search console']),
  s('HubSpot', 'marketing', ['hub spot']),
  s('Marketo', 'marketing', []),
  s('Pardot', 'marketing', ['salesforce pardot']),
  s('Mailchimp', 'marketing', ['mail chimp']),
  s('Klaviyo', 'marketing', []),
  s('ActiveCampaign', 'marketing', ['active campaign']),
  s('Constant Contact', 'marketing', []),
  s('Braze', 'marketing', []),
  s('Iterable', 'marketing', []),
  s('Customer.io', 'marketing', ['customer io']),
  s('Salesforce Marketing Cloud', 'marketing', ['marketing cloud']),
  s('Adobe Analytics', 'marketing', ['omniture']),
  s('Email Marketing', 'marketing', ['email campaigns', 'email marketing campaigns']),
  s('Marketing Automation', 'marketing', ['automation workflows']),
  s('Lead Generation', 'marketing', ['lead gen', 'demand generation', 'demand gen']),
  s('Lead Scoring', 'marketing', ['lead grading']),
  s('Lead Nurturing', 'marketing', ['drip campaigns']),
  s('Content Marketing', 'marketing', []),
  s('Content Strategy', 'marketing', ['editorial calendar']),
  s('Copywriting', 'marketing', ['copy writing', 'ad copy']),
  s('Blogging', 'marketing', ['blog writing']),
  s('Social Media Marketing', 'marketing', ['social media management', 'social media']),
  s('Community Management', 'marketing', []),
  s('Influencer Marketing', 'marketing', []),
  s('Affiliate Marketing', 'marketing', []),
  s('Brand Management', 'marketing', ['brand strategy']),
  s('Campaign Management', 'marketing', ['campaign planning', 'campaign execution']),
  s('Conversion Rate Optimization', 'marketing', ['cro']),
  s('Landing Page Optimization', 'marketing', ['landing pages']),
  s('Marketing Analytics', 'marketing', ['marketing reporting']),
  s('Attribution Modeling', 'marketing', ['marketing attribution', 'multi-touch attribution']),
  s('Web Analytics', 'marketing', []),
  s('Audience Segmentation', 'marketing', ['segmentation', 'customer segmentation', 'list segmentation']),
  s('Personalization', 'marketing', []),
  s('Product Marketing', 'marketing', []),
  s('Go-to-Market Strategy', 'marketing', ['go to market', 'gtm strategy']),
  s('Public Relations', 'marketing', ['media relations', 'press releases']),
  s('Event Marketing', 'marketing', ['event planning', 'trade shows']),
  s('Market Research', 'marketing', []),
  s('Competitive Analysis', 'marketing', ['competitor analysis']),
  s('Media Buying', 'marketing', ['media planning']),
  s('Programmatic Advertising', 'marketing', ['programmatic']),
  s('Display Advertising', 'marketing', ['banner ads']),
  s('Retargeting', 'marketing', ['remarketing']),
  s('Hotjar', 'marketing', ['hot jar']),
  s('Optimizely', 'marketing', []),
  s('Semrush', 'marketing', ['sem rush']),
  s('Ahrefs', 'marketing', []),
  s('Screaming Frog', 'marketing', []),
  s('Keyword Research', 'marketing', []),
  s('Link Building', 'marketing', ['backlinks']),
  s('Technical SEO', 'marketing', []),
  s('Local SEO', 'marketing', ['google business profile']),
  s('Webinars', 'marketing', ['webinar production']),
];

const SALES_CALLCENTER: SkillEntry[] = [
  s('Salesforce', 'sales', ['sfdc', 'sales cloud', 'salesforce crm']),
  s('CRM', 'sales', ['customer relationship management']),
  s('Convoso', 'sales', []),
  s('Five9', 'sales', ['five 9']),
  s('Genesys', 'sales', ['genesys cloud']),
  s('NICE inContact', 'sales', ['incontact']),
  s('Talkdesk', 'sales', ['talk desk']),
  s('Twilio', 'sales', []),
  s('Twilio Flex', 'sales', []),
  s('RingCentral', 'sales', ['ring central']),
  s('Dialpad', 'sales', ['dial pad']),
  s('Aircall', 'sales', ['air call']),
  s('GoHighLevel', 'sales', ['go high level', 'ghl', 'highlevel', 'high level crm']),
  s('Zendesk', 'sales', ['zen desk']),
  s('Freshdesk', 'sales', ['fresh desk']),
  s('Intercom', 'sales', []),
  s('Zoho CRM', 'sales', ['zoho']),
  s('Pipedrive', 'sales', ['pipe drive']),
  s('Outreach.io', 'sales', ['outreach io']),
  s('Salesloft', 'sales', ['sales loft']),
  s('Gong', 'sales', ['gong.io']),
  s('Apollo.io', 'sales', ['apollo io']),
  s('ZoomInfo', 'sales', ['zoom info']),
  s('Predictive Dialer', 'sales', ['dialer', 'auto dialer', 'autodialer', 'power dialer', 'dialers']),
  s('Cold Calling', 'sales', ['cold calls', 'cold outreach']),
  s('Outbound Sales', 'sales', ['outbound calling', 'outbound']),
  s('Inbound Sales', 'sales', ['inbound calling', 'inbound']),
  s('Appointment Setting', 'sales', ['appointment scheduling', 'booking appointments']),
  s('Lead Qualification', 'sales', ['qualifying leads']),
  s('Pipeline Management', 'sales', ['sales pipeline']),
  s('Quota Attainment', 'sales', ['quota', 'sales quota', 'quotas']),
  s('Account Management', 'sales', ['client management']),
  s('Business Development', 'sales', ['biz dev']),
  s('B2B Sales', 'sales', ['b2b']),
  s('B2C Sales', 'sales', ['b2c']),
  s('Inside Sales', 'sales', []),
  s('Outside Sales', 'sales', ['field sales']),
  s('Territory Management', 'sales', ['territory planning']),
  s('Solution Selling', 'sales', ['consultative selling']),
  s('Objection Handling', 'sales', ['overcoming objections']),
  s('Closing Techniques', 'sales', ['closing deals', 'deal closing']),
  s('Upselling', 'sales', ['upsell', 'upsells']),
  s('Cross-Selling', 'sales', ['cross sell', 'cross-sell']),
  s('Customer Retention', 'sales', ['client retention']),
  s('Churn Reduction', 'sales', ['churn management']),
  s('Customer Success', 'sales', ['client success']),
  s('Call Center Operations', 'sales', ['call center', 'contact center', 'call centre']),
  s('Call Quality Assurance', 'sales', ['qa scoring', 'call scoring', 'call monitoring', 'call audits']),
  s('Coaching', 'sales', ['rep coaching', 'sales coaching', 'call coaching', 'agent coaching']),
  s('Call Scripts', 'sales', ['script development', 'sales scripts', 'talk tracks']),
  s('Telemarketing', 'sales', ['telesales']),
  s('Customer Service', 'sales', ['customer support', 'client service', 'guest service']),
  s('Live Chat Support', 'sales', ['live chat', 'chat support']),
  s('Ticketing Systems', 'sales', ['ticketing', 'ticket management']),
  s('SLA Management', 'sales', ['service level agreements', 'sla']),
  s('Workforce Management', 'sales', ['wfm', 'call center scheduling']),
  s('Sales Forecasting', 'sales', ['revenue forecasting']),
  s('Sales Enablement', 'sales', []),
  s('Contract Negotiation', 'sales', ['contract management']),
  s('Proposal Writing', 'sales', ['rfp responses', 'rfps']),
];

const OPS_FINANCE_HR: SkillEntry[] = [
  s('Microsoft Excel', 'ops', ['excel', 'ms excel', 'advanced excel']),
  s('Microsoft Word', 'ops', ['ms word', 'word']),
  s('Microsoft PowerPoint', 'ops', ['powerpoint', 'ms powerpoint']),
  s('Microsoft Outlook', 'ops', ['outlook']),
  s('Microsoft Office', 'ops', ['ms office', 'office 365', 'microsoft 365']),
  s('Microsoft Access', 'ops', ['ms access', 'access']),
  s('Google Workspace', 'ops', ['g suite', 'google suite']),
  s('Google Sheets', 'ops', []),
  s('Pivot Tables', 'ops', ['pivot table']),
  s('VLOOKUP', 'ops', ['vlookups', 'xlookup']),
  s('Excel Macros', 'ops', ['macros']),
  s('QuickBooks', 'finance', ['quick books']),
  s('Xero', 'finance', []),
  s('NetSuite', 'finance', ['net suite']),
  s('SAP', 'finance', ['sap erp']),
  s('ERP Systems', 'finance', ['erp', 'enterprise resource planning']),
  s('Workday', 'ops', ['work day']),
  s('ADP', 'ops', ['adp workforce now']),
  s('Paychex', 'ops', []),
  s('Gusto', 'ops', []),
  s('Payroll', 'finance', ['payroll processing', 'payroll administration']),
  s('Accounts Payable', 'finance', ['accounts-payable']),
  s('Accounts Receivable', 'finance', ['accounts-receivable']),
  s('Bookkeeping', 'finance', []),
  s('General Ledger', 'finance', ['gl accounting']),
  s('Month-End Close', 'finance', ['month end close', 'period close']),
  s('Financial Reporting', 'finance', ['financial statements']),
  s('Financial Modeling', 'finance', ['financial models']),
  s('Budgeting', 'finance', ['budget management', 'budget planning']),
  s('Forecasting', 'finance', ['demand forecasting']),
  s('Variance Analysis', 'finance', []),
  s('P&L Management', 'finance', ['p&l', 'profit and loss', 'p and l']),
  s('Cost Accounting', 'finance', ['cost analysis']),
  s('Auditing', 'finance', ['internal audit', 'audits']),
  s('Tax Preparation', 'finance', ['tax returns', 'tax filing']),
  s('GAAP', 'finance', ['generally accepted accounting principles']),
  s('Account Reconciliation', 'finance', ['reconciliation', 'bank reconciliation', 'reconciliations']),
  s('Invoicing', 'finance', ['billing']),
  s('Procurement', 'ops', ['purchasing', 'sourcing suppliers']),
  s('Vendor Management', 'ops', ['supplier management']),
  s('Inventory Management', 'ops', ['inventory control', 'inventory', 'stock control']),
  s('Supply Chain Management', 'ops', ['supply chain']),
  s('Logistics', 'ops', ['logistics coordination']),
  s('Warehouse Management', 'ops', ['warehouse operations', 'wms']),
  s('Shipping and Receiving', 'ops', ['shipping and receiving operations']),
  s('Order Fulfillment', 'ops', ['fulfillment', 'order processing']),
  s('Demand Planning', 'ops', []),
  s('Lean Manufacturing', 'ops', ['lean']),
  s('Six Sigma', 'ops', ['lean six sigma', 'green belt', 'black belt']),
  s('Kaizen', 'ops', []),
  s('Continuous Improvement', 'ops', ['process improvement']),
  s('Root Cause Analysis', 'ops', ['rca', '5 whys']),
  s('Standard Operating Procedures', 'ops', ['sop', 'sops']),
  s('Quality Control', 'ops', ['quality inspection']),
  s('Project Management', 'ops', ['project delivery']),
  s('Program Management', 'ops', []),
  s('PMP', 'ops', ['project management professional']),
  s('Agile', 'ops', ['agile methodology', 'agile methodologies']),
  s('Scrum', 'ops', ['scrum master', 'sprint planning']),
  s('Kanban', 'ops', []),
  s('Waterfall', 'ops', []),
  s('SAFe', 'ops', ['scaled agile framework']),
  s('Jira', 'ops', ['atlassian jira']),
  s('Confluence', 'ops', []),
  s('Asana', 'ops', []),
  s('Trello', 'ops', []),
  s('Monday.com', 'ops', ['monday com']),
  s('ClickUp', 'ops', ['click up']),
  s('Smartsheet', 'ops', ['smart sheet']),
  s('Notion', 'ops', []),
  s('Slack', 'ops', []),
  s('Microsoft Teams', 'ops', ['ms teams']),
  s('Zoom', 'ops', ['zoom meetings']),
  s('Stakeholder Management', 'ops', ['stakeholder communication']),
  s('Change Management', 'ops', []),
  s('Risk Management', 'ops', ['risk mitigation']),
  s('Resource Planning', 'ops', ['resource allocation']),
  s('Capacity Planning', 'ops', []),
  s('Recruiting', 'ops', ['recruitment', 'talent acquisition', 'full-cycle recruiting']),
  s('Applicant Tracking System', 'ops', ['ats', 'applicant tracking']),
  s('Employee Onboarding', 'ops', ['onboarding']),
  s('Performance Management', 'ops', ['performance reviews', 'performance appraisals']),
  s('Employee Relations', 'ops', []),
  s('HRIS', 'ops', ['human resources information system']),
  s('Benefits Administration', 'ops', ['benefits enrollment']),
  s('Compensation Planning', 'ops', ['compensation and benefits']),
  s('Learning and Development', 'ops', ['l&d', 'talent development']),
  s('Training and Development', 'ops', ['training delivery', 'employee training']),
  s('Succession Planning', 'ops', []),
  s('Workforce Planning', 'ops', ['headcount planning']),
  s('Diversity and Inclusion', 'ops', ['dei', 'd&i']),
  s('Candidate Sourcing', 'ops', ['sourcing candidates', 'boolean search']),
  s('LinkedIn Recruiter', 'ops', []),
  s('Greenhouse', 'ops', []),
  s('BambooHR', 'ops', ['bamboo hr']),
  s('Zapier', 'ops', []),
  s('Airtable', 'ops', ['air table']),
  s('Power Automate', 'ops', ['microsoft power automate', 'flow automation']),
  s('Power Apps', 'ops', ['powerapps']),
  s('Make.com', 'ops', ['integromat']),
  s('n8n', 'ops', []),
  s('Data Entry', 'ops', ['data input']),
  s('Calendar Management', 'ops', ['scheduling meetings']),
  s('Travel Coordination', 'ops', ['travel arrangements']),
  s('Office Administration', 'ops', ['office management', 'administrative support']),
  s('Records Management', 'ops', ['document management', 'filing systems']),
  s('Technical Writing', 'ops', ['documentation writing']),
  s('Process Documentation', 'ops', ['process mapping']),
];

const HEALTHCARE: SkillEntry[] = [
  s('Registered Nurse', 'healthcare', ['rn', 'registered nursing']),
  s('Licensed Practical Nurse', 'healthcare', ['lpn', 'lvn']),
  s('Certified Nursing Assistant', 'healthcare', ['cna']),
  s('Nurse Practitioner', 'healthcare', ['nurse practitioners']),
  s('Patient Care', 'healthcare', ['direct patient care']),
  s('Patient Assessment', 'healthcare', ['patient evaluation']),
  s('Vital Signs', 'healthcare', ['vitals monitoring']),
  s('Medication Administration', 'healthcare', ['med pass']),
  s('Phlebotomy', 'healthcare', ['venipuncture', 'blood draws']),
  s('IV Therapy', 'healthcare', ['iv insertion', 'intravenous therapy']),
  s('Wound Care', 'healthcare', ['wound dressing']),
  s('CPR', 'healthcare', ['cpr certified', 'cardiopulmonary resuscitation']),
  s('BLS', 'healthcare', ['basic life support']),
  s('ACLS', 'healthcare', ['advanced cardiac life support']),
  s('EMR', 'healthcare', ['electronic medical records']),
  s('EHR', 'healthcare', ['electronic health records']),
  s('Epic', 'healthcare', ['epic systems', 'epic emr']),
  s('Cerner', 'healthcare', []),
  s('Meditech', 'healthcare', ['medi tech']),
  s('Allscripts', 'healthcare', ['all scripts']),
  s('HIPAA', 'healthcare', ['hipaa compliance']),
  s('Medical Terminology', 'healthcare', []),
  s('Medical Coding', 'healthcare', ['icd-10', 'cpt coding', 'icd 10']),
  s('Medical Billing', 'healthcare', ['claims processing', 'insurance verification']),
  s('Clinical Documentation', 'healthcare', ['charting']),
  s('Triage', 'healthcare', ['patient triage']),
  s('Telehealth', 'healthcare', ['telemedicine']),
  s('Infection Control', 'healthcare', ['sterilization']),
  s('Case Management', 'healthcare', ['care coordination']),
  s('Pharmacy Technician', 'healthcare', ['pharm tech']),
  s('Radiology', 'healthcare', ['x-ray imaging']),
  s('Physical Therapy', 'healthcare', ['physical therapist']),
  s('Occupational Therapy', 'healthcare', ['occupational therapist']),
  s('Behavioral Health', 'healthcare', ['mental health support']),
  s('Long-Term Care', 'healthcare', ['long term care', 'skilled nursing']),
  s('Home Health', 'healthcare', ['home health care', 'home care']),
  s('Acute Care', 'healthcare', []),
  s('ICU', 'healthcare', ['intensive care unit', 'critical care']),
  s('Emergency Room', 'healthcare', ['er nursing', 'emergency department']),
  s('Medical Assistant', 'healthcare', ['cma', 'medical assisting']),
  s('Immunization', 'healthcare', ['vaccination', 'vaccinations']),
  s('Patient Advocacy', 'healthcare', []),
];

const TRADES_LOGISTICS: SkillEntry[] = [
  s('CDL', 'trades', ['commercial driver license', "commercial driver's license", 'cdl-a', 'class a cdl', 'cdl a']),
  s('Forklift Operation', 'trades', ['forklift', 'forklift certified', 'forklift certification']),
  s('OSHA', 'trades', ['osha 10', 'osha 30', 'osha compliance']),
  s('HVAC', 'trades', ['heating ventilation and air conditioning', 'hvac-r', 'hvac r']),
  s('Welding', 'trades', ['mig welding', 'tig welding', 'arc welding', 'welder']),
  s('Plumbing', 'trades', ['pipefitting']),
  s('Electrical Wiring', 'trades', ['electrical installation', 'electrician']),
  s('Carpentry', 'trades', ['framing carpentry']),
  s('Masonry', 'trades', ['bricklaying', 'concrete work']),
  s('Roofing', 'trades', []),
  s('Blueprint Reading', 'trades', ['blueprints', 'schematics']),
  s('Hand Tools', 'trades', ['power tools']),
  s('Preventive Maintenance', 'trades', ['preventative maintenance', 'pm schedules']),
  s('Troubleshooting', 'trades', ['diagnostics']),
  s('Equipment Repair', 'trades', ['machine repair']),
  s('CNC Machining', 'trades', ['cnc', 'cnc programming', 'machining']),
  s('Hydraulics', 'trades', []),
  s('Pneumatics', 'trades', []),
  s('PLC Programming', 'trades', ['plc', 'allen bradley']),
  s('SCADA', 'trades', []),
  s('Diesel Mechanics', 'trades', ['diesel engine repair', 'diesel technician']),
  s('Automotive Repair', 'trades', ['auto repair', 'automotive technician']),
  s('ASE Certification', 'trades', ['ase certified']),
  s('Heavy Equipment Operation', 'trades', ['heavy equipment', 'excavator operation']),
  s('Pallet Jack', 'trades', ['pallet jacks']),
  s('Order Picking', 'trades', ['picking and packing', 'pick and pack']),
  s('RF Scanner', 'trades', ['rf scanning', 'barcode scanning']),
  s('Route Planning', 'trades', ['route optimization']),
  s('DOT Compliance', 'trades', ['dot regulations', 'hours of service']),
  s('Hazmat', 'trades', ['hazardous materials']),
  s('Fall Protection', 'trades', []),
  s('Lockout/Tagout', 'trades', ['loto', 'lockout tagout']),
  s('Workplace Safety', 'trades', ['safety compliance', 'safety training', 'safety protocols']),
  s('Landscaping', 'trades', ['grounds maintenance']),
  s('Janitorial', 'trades', ['custodial', 'facility cleaning']),
  s('Construction Management', 'trades', ['construction supervision']),
  s('Cost Estimating', 'trades', ['estimating', 'bid estimating']),
  s('Facilities Management', 'trades', ['facility maintenance', 'building maintenance']),
  s('Forklift Safety', 'trades', ['material handling']),
];

const HOSPITALITY_RETAIL: SkillEntry[] = [
  s('POS Systems', 'other', ['pos', 'point of sale']),
  s('Cash Handling', 'other', ['cash register', 'cash management']),
  s('Merchandising', 'other', ['visual merchandising']),
  s('Loss Prevention', 'other', ['shrink reduction']),
  s('Stocking', 'other', ['restocking', 'shelf stocking']),
  s('Planograms', 'other', ['planogram compliance']),
  s('Food Safety', 'other', ['servsafe', 'food handling', 'haccp']),
  s('Food Preparation', 'other', ['food prep', 'line cooking']),
  s('Bartending', 'other', ['mixology']),
  s('Catering', 'other', ['catering services']),
  s('Housekeeping', 'other', ['room attendant']),
  s('Front Desk Operations', 'other', ['front desk', 'guest check-in']),
  s('Hospitality Management', 'other', ['hotel management']),
  s('Reservations', 'other', ['reservation management']),
  s('Guest Relations', 'other', ['guest services']),
  s('Menu Planning', 'other', ['menu development']),
  s('Event Coordination', 'other', ['event coordination and setup']),
  s('Square POS', 'other', ['square pos system']),
  s('Toast POS', 'other', ['toast pos system']),
  s('Retail Sales', 'other', ['retail operations']),
  s('Store Management', 'other', ['store operations']),
];

const SOFT_SKILLS: SkillEntry[] = [
  s('Leadership', 'soft', ['team leadership', 'people leadership']),
  s('Communication', 'soft', ['communication skills', 'verbal communication', 'written communication']),
  s('Collaboration', 'soft', ['teamwork', 'team collaboration']),
  s('Mentoring', 'soft', ['mentorship']),
  s('Negotiation', 'soft', ['negotiation skills']),
  s('Public Speaking', 'soft', ['presentation skills', 'presentations']),
  s('Problem Solving', 'soft', ['problem-solving']),
  s('Critical Thinking', 'soft', []),
  s('Time Management', 'soft', []),
  s('Organizational Skills', 'soft', ['organization skills']),
  s('Attention to Detail', 'soft', ['detail oriented', 'detail-oriented']),
  s('Adaptability', 'soft', ['flexibility']),
  s('Conflict Resolution', 'soft', ['de-escalation']),
  s('Decision Making', 'soft', ['decision-making']),
  s('Emotional Intelligence', 'soft', []),
  s('Active Listening', 'soft', []),
  s('Multitasking', 'soft', ['multi-tasking']),
  s('Self-Motivation', 'soft', ['self motivated', 'self-starter', 'self starter']),
  s('Work Ethic', 'soft', ['strong work ethic']),
  s('Creativity', 'soft', ['creative thinking']),
  s('Analytical Skills', 'soft', ['analytical thinking']),
  s('Cross-Functional Collaboration', 'soft', ['cross functional', 'cross-functional']),
  s('Relationship Building', 'soft', ['rapport building']),
  s('Delegation', 'soft', []),
  s('Strategic Planning', 'soft', ['strategic thinking']),
  s('Research', 'soft', ['research skills']),
  s('Bilingual', 'other', ['bilingual spanish']),
  s('Spanish', 'other', ['spanish speaking']),
  s('French', 'other', []),
  s('German', 'other', []),
  s('Mandarin', 'other', ['mandarin chinese']),
  s('Typing', 'other', ['typing speed', 'wpm']),
  s('Notary Public', 'other', ['notary']),
];

/** ≥ 400 skills spanning software, product/design, marketing, sales ops, operations,
 *  finance, HR, healthcare, trades, logistics, hospitality/retail and soft skills. */
export const SKILL_DICTIONARY: SkillEntry[] = [
  ...LANGUAGES,
  ...FRAMEWORKS,
  ...CLOUD_DEVOPS,
  ...DATA_AI,
  ...SECURITY,
  ...MOBILE_TESTING,
  ...PRODUCT_DESIGN,
  ...MARKETING,
  ...SALES_CALLCENTER,
  ...OPS_FINANCE_HR,
  ...HEALTHCARE,
  ...TRADES_LOGISTICS,
  ...HOSPITALITY_RETAIL,
  ...SOFT_SKILLS,
];

// ---------------------------------------------------------------------------
// Ambiguity rules
// ---------------------------------------------------------------------------

interface AmbiguityRule {
  /** At least one of these tokens must appear within `window` tokens on either side. */
  near?: string[];
  /** Tokens on either side of the alias that are checked (default 6). */
  window?: number;
  /** Reject when the immediately following token is one of these. */
  notFollowedBy?: string[];
}

const PROGRAMMING_CONTEXT = [
  'programming', 'language', 'languages', 'backend', 'back-end', 'frontend', 'developer', 'engineer',
  'engineering', 'software', 'code', 'coding', 'microservices', 'api', 'apis', 'stack', 'compiler', 'runtime',
];

/** Aliases that are also everyday English. Keyed by the tokenized alias phrase. */
const AMBIGUOUS_ALIASES: Record<string, AmbiguityRule> = {
  go: { near: ['golang', 'lang', 'language', 'languages', 'programming', 'microservices', 'kubernetes', 'docker', 'rust', 'backend', 'grpc'] },
  c: { near: ['c++', 'embedded', 'firmware', 'kernel', 'programming', 'language', 'languages', 'assembly', 'gcc', 'arduino', 'rtos'] },
  r: { near: ['python', 'statistical', 'statistics', 'sas', 'spss', 'matlab', 'language', 'programming', 'shiny', 'tidyverse', 'ggplot'] },
  react: {
    near: [
      'javascript', 'typescript', 'js', 'ts', 'frontend', 'front', 'ui', 'redux', 'hooks', 'native', 'next.js',
      'nextjs', 'angular', 'vue', 'node', 'node.js', 'developer', 'engineer', 'web', 'spa', 'component',
      'components', 'jsx', 'tailwind', 'css', 'html', 'stack', 'graphql', 'webpack', 'vite',
    ],
    window: 10,
  },
  rust: { near: [...PROGRAMMING_CONTEXT, 'cargo', 'wasm', 'systems', 'memory', 'c++', 'golang'] },
  ruby: { near: [...PROGRAMMING_CONTEXT, 'rails', 'ror', 'gem', 'gems', 'sinatra'] },
  swift: { near: ['ios', 'apple', 'xcode', 'objective-c', 'objc', 'mobile', 'app', 'apps', 'swiftui', 'macos', 'iphone', 'ipad', 'cocoa'] },
  dart: { near: ['flutter', 'mobile', 'google', 'language', 'app', 'apps', 'widgets'] },
  scala: { near: [...PROGRAMMING_CONTEXT, 'spark', 'akka', 'jvm', 'java', 'kafka'] },
  flask: { near: ['python', 'django', 'api', 'apis', 'backend', 'web', 'fastapi', 'microservice', 'microservices', 'werkzeug'] },
  spark: { near: ['apache', 'hadoop', 'scala', 'big', 'data', 'pyspark', 'databricks', 'etl', 'streaming', 'emr'] },
  hive: { near: ['hadoop', 'apache', 'big', 'data', 'hdfs', 'spark', 'impala', 'presto'] },
  shell: { near: ['bash', 'scripting', 'script', 'scripts', 'unix', 'linux', 'powershell', 'zsh', 'ksh', 'sh'] },
  node: { near: ['javascript', 'typescript', 'express', 'npm', 'backend', 'server', 'api', 'apis', 'react', 'mongodb', 'nest', 'developer', 'engineer', 'js'] },
  excel: { notFollowedBy: ['at', 'in', 'when', 'with', 'here'] },
  word: { near: ['microsoft', 'ms', 'office', 'excel', 'powerpoint', 'outlook', 'documents', 'processing'] },
  access: { near: ['microsoft', 'ms', 'office', 'database', 'databases', 'queries', 'vba'] },
  epic: { near: ['emr', 'ehr', 'cerner', 'meditech', 'charting', 'medical', 'health', 'records', 'clinical', 'hospital', 'nursing', 'systems', 'hyperspace'] },
  sketch: { near: ['figma', 'design', 'designer', 'ui', 'ux', 'adobe', 'prototype', 'prototyping', 'invision', 'wireframes', 'mockups'] },
  blender: { near: ['3d', 'modeling', 'modelling', 'render', 'rendering', 'animation', 'maya', 'unity', 'unreal', 'cinema'] },
  lean: { near: ['six', 'sigma', 'manufacturing', 'kaizen', 'process', 'production', 'startup', 'principles', 'methodology', 'waste'] },
  inbound: { near: ['calls', 'call', 'calling', 'sales', 'leads', 'lead', 'marketing', 'queue', 'volume', 'center', 'customers'] },
  outbound: { near: ['calls', 'call', 'calling', 'sales', 'leads', 'lead', 'dials', 'dialing', 'campaign', 'campaigns', 'center', 'prospecting'] },
  gong: { near: ['call', 'calls', 'revenue', 'sales', 'recording', 'recordings', 'conversation', 'intelligence', 'salesloft', 'outreach.io'] },
  quota: { near: ['sales', 'attainment', 'monthly', 'quarterly', 'annual', 'exceeded', 'targets', 'target', 'revenue', 'reps', 'rep'] },
  pos: { near: ['point', 'sale', 'sales', 'register', 'registers', 'retail', 'system', 'systems', 'terminal', 'restaurant', 'checkout', 'cashier'] },
  rn: { near: ['nurse', 'nurses', 'nursing', 'bsn', 'patient', 'patients', 'clinical', 'licensed', 'license', 'hospital', 'lpn', 'cna', 'unit', 'shift'] },
  ml: { near: ['machine', 'learning', 'model', 'models', 'data', 'deep', 'nlp', 'tensorflow', 'pytorch', 'pipeline', 'pipelines', 'training'] },
  ai: { near: ['machine', 'learning', 'models', 'model', 'llm', 'llms', 'generative', 'data', 'automation', 'powered', 'tools', 'agents', 'chatbot', 'openai', 'anthropic'] },
  ui: { near: ['ux', 'design', 'designer', 'frontend', 'front-end', 'interface', 'components', 'figma', 'web', 'mobile', 'react', 'css'] },
  ux: { near: ['ui', 'design', 'designer', 'research', 'user', 'usability', 'wireframes', 'prototyping', 'figma', 'product'] },
  ats: { near: ['applicant', 'tracking', 'resume', 'resumes', 'recruiting', 'recruitment', 'greenhouse', 'workday', 'lever', 'hiring', 'friendly', 'systems', 'system'] },
  ts: { near: ['javascript', 'js', 'react', 'node', 'angular', 'vue', 'frontend', 'backend', 'types', 'typed'] },
  rest: { near: ['api', 'apis', 'services', 'endpoints', 'json', 'http', 'soap', 'graphql', 'web'] },
  sap: { near: ['erp', 'modules', 'finance', 'implementation', 'hana', 'abap', 'fico', 'systems', 'system', 'business'] },
  charting: { near: ['emr', 'ehr', 'patient', 'patients', 'clinical', 'medical', 'nursing', 'documentation', 'epic', 'cerner'] },
  research: { near: ['user', 'market', 'keyword', 'competitive', 'qualitative', 'quantitative', 'primary', 'secondary', 'conduct', 'conducting', 'skills', 'analysis'] },
  safe: { near: ['agile', 'scrum', 'scaled', 'framework', 'lean', 'portfolio', 'release', 'train', 'sprint', 'epics'] },
  greenhouse: { near: ['ats', 'recruiting', 'recruitment', 'applicant', 'lever', 'workday', 'hiring', 'candidates', 'interview', 'sourcing'] },
  notion: { near: ['confluence', 'slack', 'asana', 'trello', 'jira', 'docs', 'wiki', 'workspace', 'documentation', 'tools', 'airtable'] },
  triage: { near: ['patient', 'patients', 'nurse', 'nursing', 'emergency', 'clinical', 'acuity', 'tickets', 'ticket', 'incidents', 'issues'] },
};

// ---------------------------------------------------------------------------
// Alias index
// ---------------------------------------------------------------------------

const ALIAS_INDEX = new Map<string, string>();
/** first token of a phrase → longest phrase (in tokens) that starts with it */
const PREFIX_MAX = new Map<string, number>();
const CATEGORY_BY_CANONICAL = new Map<string, SkillCategory>();
const CANONICAL_SET = new Set<string>();

function aliasKey(alias: string): string {
  return tokenizeAll(alias).join(' ');
}

function registerAlias(alias: string, canonical: string): void {
  const key = aliasKey(alias);
  if (!key) return;
  if (ALIAS_INDEX.has(key)) return; // first registration wins; duplicates are asserted against in tests
  ALIAS_INDEX.set(key, canonical);
  const parts = key.split(' ');
  const first = parts[0];
  const len = parts.length;
  const current = PREFIX_MAX.get(first);
  if (current === undefined || len > current) PREFIX_MAX.set(first, len);
}

for (const entry of SKILL_DICTIONARY) {
  CANONICAL_SET.add(entry.canonical);
  CATEGORY_BY_CANONICAL.set(entry.canonical, entry.category);
  registerAlias(entry.canonical, entry.canonical);
  for (const alias of entry.aliases) registerAlias(alias, entry.canonical);
}

/** Every alias registered for the dictionary, keyed by its tokenized form. Useful for tests. */
export function skillAliasKeys(): string[] {
  return [...ALIAS_INDEX.keys()];
}

/** Category of a canonical skill name, or `undefined` when it is not in the dictionary. */
export function skillCategory(canonical: string): SkillCategory | undefined {
  return CATEGORY_BY_CANONICAL.get(canonical);
}

/** True when the string is exactly a canonical dictionary skill name. */
export function isCanonicalSkill(name: string): boolean {
  return CANONICAL_SET.has(name);
}

/**
 * Map a free-text skill ("hub spot", "NODE.JS", "customer support") to its canonical
 * dictionary name, or `null` when unknown. Ambiguity rules are intentionally skipped:
 * a user who typed "Go" into their skills list means the language.
 */
export function canonicalSkillFor(text: string): string | null {
  if (!text) return null;
  const key = aliasKey(text);
  if (!key) return null;
  return ALIAS_INDEX.get(key) ?? null;
}

function passesAmbiguity(phrase: string, tokens: string[], start: number, len: number): boolean {
  const rule = AMBIGUOUS_ALIASES[phrase];
  if (!rule) return true;
  const after = tokens[start + len];
  if (rule.notFollowedBy && after !== undefined && rule.notFollowedBy.includes(after)) return false;
  if (!rule.near || rule.near.length === 0) return true;
  const window = rule.window ?? 6;
  const from = Math.max(0, start - window);
  const to = Math.min(tokens.length, start + len + window);
  for (let i = from; i < to; i++) {
    if (i >= start && i < start + len) continue;
    if (rule.near.includes(tokens[i])) return true;
  }
  return false;
}

/** Looks like markup? Then run it through {@link stripHtml} first. */
function toPlainText(text: string): string {
  if (!text) return '';
  return /<[a-z!/][^>]*>/i.test(text) ? stripHtml(text) : text;
}

function extractSkillsFromTokens(tokens: string[]): string[] {
  const found: string[] = [];
  if (tokens.length === 0) return found;
  const seen = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    const maxLen = PREFIX_MAX.get(tokens[i]);
    if (maxLen === undefined) continue;
    const upper = Math.min(maxLen, tokens.length - i);
    for (let len = upper; len >= 1; len--) {
      const phrase = len === 1 ? tokens[i] : tokens.slice(i, i + len).join(' ');
      const canonical = ALIAS_INDEX.get(phrase);
      if (canonical === undefined) continue;
      if (!passesAmbiguity(phrase, tokens, i, len)) continue;
      if (!seen.has(canonical)) {
        seen.add(canonical);
        found.push(canonical);
      }
      i += len - 1;
      break;
    }
  }
  return found;
}

/**
 * Canonical skill names found in `text`, longest alias first, deduped, in order of first
 * appearance. Case-insensitive and multi-word aware; runs in a fraction of a millisecond
 * on a 20 KB job description.
 */
export function extractSkills(text: string): string[] {
  return extractSkillsFromTokens(tokenizeAll(toPlainText(text)));
}

// ---------------------------------------------------------------------------
// Keyword extraction
// ---------------------------------------------------------------------------

export interface KeywordHit {
  term: string;
  count: number;
}

/** Line breaks and sentence ends — phrases do not run across them. */
const SEGMENT_SPLIT = /\n+|(?<=[.;!?])\s+/;

const CAPITALIZED_RE = /\b[A-Z][A-Za-z0-9]*(?:[.+#/-][A-Za-z0-9]+)*\b/g;
const ACRONYM_RE = /\b[A-Z][A-Z0-9]{1,6}\b/g;

/** Terms the source text presents as proper nouns / acronyms carry more weight. */
function prominence(plain: string): { capitalized: Set<string>; acronyms: Set<string> } {
  const capCount = new Map<string, number>();
  const caps = plain.match(CAPITALIZED_RE);
  if (caps) {
    for (const raw of caps) {
      const key = raw.toLowerCase();
      capCount.set(key, (capCount.get(key) ?? 0) + 1);
    }
  }
  const acronyms = new Set<string>();
  const acr = plain.match(ACRONYM_RE);
  if (acr) for (const raw of acr) acronyms.add(raw.toLowerCase());
  const capitalized = new Set<string>();
  // A single capital at the start of a sentence proves nothing; two occurrences do.
  for (const [key, n] of capCount) if (n >= 2 || acronyms.has(key)) capitalized.add(key);
  return { capitalized, acronyms };
}

/**
 * Frequent, meaningful terms (unigrams + bigrams) from a job description or resume.
 * Stopwords and job-ad boilerplate ("team", "role", "experience", …) are removed;
 * capitalized and acronym terms are boosted. Dictionary hits are returned under their
 * canonical name so the UI can show "HubSpot" rather than "hubspot".
 */
export function extractKeywords(text: string, limit = 20): KeywordHit[] {
  const max = Math.max(0, Math.floor(limit));
  if (max === 0) return [];
  const plain = toPlainText(text);
  if (!plain.trim()) return [];
  const { capitalized, acronyms } = prominence(plain);

  const unigrams = new Map<string, number>();
  const bigrams = new Map<string, number>();
  let tokenCount = 0;
  // Bigrams never span a line or sentence boundary — "…A/B testing\nNice to have:" must
  // not produce "testing nice".
  for (const segment of normalizeText(plain).split(SEGMENT_SPLIT)) {
    const tokens = tokenizeNormalized(segment);
    tokenCount += tokens.length;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (isNoiseToken(t)) continue;
      unigrams.set(t, (unigrams.get(t) ?? 0) + 1);
      const next = tokens[i + 1];
      if (next === undefined || isNoiseToken(next)) continue;
      const pair = `${t} ${next}`;
      bigrams.set(pair, (bigrams.get(pair) ?? 0) + 1);
    }
  }
  if (tokenCount === 0) return [];

  const minBigram = tokenCount >= 120 ? 2 : 1;
  type Scored = { term: string; count: number; score: number; isBigram: boolean };
  const scored: Scored[] = [];

  const boostFor = (term: string, isBigram: boolean): number => {
    if (!isBigram) {
      if (acronyms.has(term)) return 1.9;
      if (capitalized.has(term)) return 1.5;
      return 1;
    }
    const [a, b] = term.split(' ');
    const hits = (capitalized.has(a) ? 1 : 0) + (capitalized.has(b) ? 1 : 0);
    return 1.4 + hits * 0.25;
  };

  for (const [term, count] of unigrams) {
    scored.push({ term, count, score: count * boostFor(term, false), isBigram: false });
  }
  for (const [term, count] of bigrams) {
    if (count < minBigram) continue;
    scored.push({ term, count, score: count * boostFor(term, true), isBigram: true });
  }

  scored.sort((a, b) => b.score - a.score || b.count - a.count || (a.term < b.term ? -1 : a.term > b.term ? 1 : 0));

  // Drop unigrams that only ever occur inside an equally frequent, higher-ranked bigram.
  const coveredByBigram = new Map<string, number>();
  for (const item of scored) {
    if (!item.isBigram) continue;
    for (const part of item.term.split(' ')) {
      const best = coveredByBigram.get(part);
      if (best === undefined || item.count > best) coveredByBigram.set(part, item.count);
    }
  }

  const out: KeywordHit[] = [];
  const seenTerms = new Set<string>();
  for (const item of scored) {
    if (out.length >= max) break;
    if (!item.isBigram) {
      const covered = coveredByBigram.get(item.term);
      if (covered !== undefined && covered >= item.count) continue;
    }
    const display = ALIAS_INDEX.get(item.term) ?? item.term;
    if (seenTerms.has(display)) continue;
    seenTerms.add(display);
    out.push({ term: display, count: item.count });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Requirement splitting
// ---------------------------------------------------------------------------

export interface JobRequirements {
  required: string[];
  niceToHave: string[];
}

const NICE_CUE =
  /\b(nice[\s-]to[\s-]have|nice[\s-]to[\s-]haves|preferred|preferable|preferably|bonus|a plus|big plus|huge plus|pluses|ideally|desired|desirable|good to have|great to have|would be great|optional|not required|advantageous|extra credit|icing on the cake)\b/;

const REQUIRED_CUE =
  /\b(required|requirement|requirements|must have|must haves|must be|must possess|minimum|at least|you have|you'll have|you will have|you bring|what you bring|what you'll need|qualifications|essential|we require|need to have|should have|proficiency|proficient|expertise in|demonstrated|hands[\s-]on experience|years of experience)\b/;

function isHeadingLike(segment: string): boolean {
  if (segment.length > 64) return false;
  if (/[:：]\s*$/.test(segment)) return true;
  return segment.split(/\s+/).filter(Boolean).length <= 6;
}

/**
 * Split a job posting into the skills it requires and the ones it merely prefers.
 *
 * Cue words are detected per line and per sentence; a short line that contains a cue
 * ("Requirements:", "Nice to have") switches the mode for the lines that follow it.
 * With no cues anywhere, every detected skill is treated as required.
 */
export function extractRequirements(jobText: string): JobRequirements {
  const plain = toPlainText(jobText);
  if (!plain.trim()) return { required: [], niceToHave: [] };

  const required: string[] = [];
  const nice: string[] = [];
  const requiredSeen = new Set<string>();
  const niceSeen = new Set<string>();
  let mode: 'required' | 'nice' = 'required';

  // One normalization pass for the whole posting; segments are tokenized directly.
  for (const rawSegment of normalizeText(plain).split(SEGMENT_SPLIT)) {
    const segment = rawSegment.trim();
    if (!segment) continue;
    const isNice = NICE_CUE.test(segment);
    const isRequired = !isNice && REQUIRED_CUE.test(segment);
    let segMode: 'required' | 'nice' = mode;
    if (isNice) segMode = 'nice';
    else if (isRequired) segMode = 'required';
    if ((isNice || isRequired) && isHeadingLike(segment)) mode = segMode;

    const skills = extractSkillsFromTokens(tokenizeNormalized(segment, true));
    if (skills.length === 0) continue;
    if (segMode === 'nice') {
      for (const skill of skills) {
        if (niceSeen.has(skill)) continue;
        niceSeen.add(skill);
        nice.push(skill);
      }
    } else {
      for (const skill of skills) {
        if (requiredSeen.has(skill)) continue;
        requiredSeen.add(skill);
        required.push(skill);
      }
    }
  }

  return { required, niceToHave: nice.filter((skill) => !requiredSeen.has(skill)) };
}

// Re-exported so consumers get the whole text toolkit from one module.
export { JOB_AD_STOPWORDS, STOPWORDS, isNoiseToken, isNumericToken };
