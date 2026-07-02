#!/usr/bin/env python3
"""Fix all-caps h2/h3 headings and remove editorial artifacts from psych pages."""

import re
import os

BASE = '/home/josh/joshuaopolko/static'

PAGES = {
    'embodied-terror-physical-restriction-as-amplifier-of-death-anxiety-and-driver-of-religious-fundamentalism': [
        ('<h2 class="wp-block-heading"><strong><strong>ABSTRACT</strong></strong></h2>',
         '<h2 class="wp-block-heading">Abstract</h2>'),
        ('<h2 class="wp-block-heading"><strong>1. TERROR MANAGEMENT THEORY: THE FOUNDATION</strong></h2>',
         '<h2 class="wp-block-heading">1. Terror Management Theory: The Foundation</h2>'),
        ('<h2 class="wp-block-heading"><strong>2. CHILDHOOD TRAUMA AND FUNDAMENTALISM: DOCUMENTED CORRELATION</strong></h2>',
         '<h2 class="wp-block-heading">2. Childhood Trauma and Fundamentalism: Documented Correlation</h2>'),
        ('<h2 class="wp-block-heading"><strong>3. PHYSICAL RESTRICTION: THE MISSING MECHANISM</strong></h2>',
         '<h2 class="wp-block-heading">3. Physical Restriction: The Missing Mechanism</h2>'),
        ('<h2 class="wp-block-heading"><strong>4. RESTRICTION-AMPLIFIED TERROR AND RELIGIOUS CAPTURE</strong></h2>',
         '<h2 class="wp-block-heading">4. Restriction-Amplified Terror and Religious Capture</h2>'),
        ('<h2 class="wp-block-heading"><strong>5. THE COMFORT TRAP</strong></h2>',
         '<h2 class="wp-block-heading">5. The Comfort Trap</h2>'),
        ('<h2 class="wp-block-heading"><strong>6. EVIDENCE AND PREDICTIONS</strong></h2>',
         '<h2 class="wp-block-heading">6. Evidence and Predictions</h2>'),
        ('<h2 class="wp-block-heading"><strong>7. CLINICAL AND SOCIAL IMPLICATIONS</strong></h2>',
         '<h2 class="wp-block-heading">7. Clinical and Social Implications</h2>'),
        ('<h2 class="wp-block-heading"><strong>8. LIMITATIONS AND FUTURE RESEARCH</strong></h2>',
         '<h2 class="wp-block-heading">8. Limitations and Future Research</h2>'),
        ('<h2 class="wp-block-heading"><strong>9. CONCLUSION</strong></h2>',
         '<h2 class="wp-block-heading">9. Conclusion</h2>'),
        ('<h2 class="wp-block-heading"><strong>REFERENCES</strong></h2>',
         '<h2 class="wp-block-heading">References</h2>'),
    ],
    'terror-management-and-religious-control-how-death-anxiety-drives-authoritarian-belief': [
        ('<h2 class="wp-block-heading"><strong>ABSTRACT</strong></h2>',
         '<h2 class="wp-block-heading">Abstract</h2>'),
        ('<h2 class="wp-block-heading"><strong>1. TERROR MANAGEMENT FUNDAMENTALS</strong></h2>',
         '<h2 class="wp-block-heading">1. Terror Management Fundamentals</h2>'),
        ('<h2 class="wp-block-heading"><strong>2. CONTROL AS TERROR MANAGEMENT</strong></h2>',
         '<h2 class="wp-block-heading">2. Control as Terror Management</h2>'),
        ('<h2 class="wp-block-heading"><strong>3. AUTHORITARIAN STRUCTURES</strong></h2>',
         '<h2 class="wp-block-heading">3. Authoritarian Structures</h2>'),
        ('<h2 class="wp-block-heading"><strong>4. CONDITIONAL IMMORTALITY AS CONTROL</strong></h2>',
         '<h2 class="wp-block-heading">4. Conditional Immortality as Control</h2>'),
        ('<h2 class="wp-block-heading"><strong>5. WHY EVIDENCE DOESN&#8217;T MATTER</strong></h2>',
         '<h2 class="wp-block-heading">5. Why Evidence Doesn\'t Matter</h2>'),
        ('<h2 class="wp-block-heading"><strong>6. GENERATIONAL TRANSMISSION</strong></h2>',
         '<h2 class="wp-block-heading">6. Generational Transmission</h2>'),
        ('<h2 class="wp-block-heading"><strong>7. THE FUNDAMENTALIST PARADOX</strong></h2>',
         '<h2 class="wp-block-heading">7. The Fundamentalist Paradox</h2>'),
        ('<h2 class="wp-block-heading"><strong>8. IMPLICATIONS</strong></h2>',
         '<h2 class="wp-block-heading">8. Implications</h2>'),
        ('<h2 class="wp-block-heading"><strong>9. CONCLUSION</strong></h2>',
         '<h2 class="wp-block-heading">9. Conclusion</h2>'),
        ('<h2 class="wp-block-heading"><strong>REFERENCES</strong></h2>',
         '<h2 class="wp-block-heading">References</h2>'),
    ],
    'hypersensitivity-a-unified-theory-of-adaptation-across-marginalized-communities': [
        ('<h2 class="wp-block-heading"><strong>ABSTRACT</strong></h2>',
         '<h2 class="wp-block-heading">Abstract</h2>'),
        ('<h2 class="wp-block-heading"><strong>1. AFFECTED COMMUNITIES AND ADAPTATIONS</strong></h2>',
         '<h2 class="wp-block-heading">1. Affected Communities and Adaptations</h2>'),
        ('<h2 class="wp-block-heading"><strong>2. THE COMMON ADAPTATION</strong></h2>',
         '<h2 class="wp-block-heading">2. The Common Adaptation</h2>'),
        ('<h2 class="wp-block-heading"><strong>3. DEVELOPED CAPACITIES AND PROFESSIONAL ADVANTAGES</strong></h2>',
         '<h2 class="wp-block-heading">3. Developed Capacities and Professional Advantages</h2>'),
        ('<h2 class="wp-block-heading"><strong>4. THE CRITICAL FORK: TWO DEVELOPMENTAL PATHS</strong></h2>',
         '<h2 class="wp-block-heading">4. The Critical Fork: Two Developmental Paths</h2>'),
        ('<h2 class="wp-block-heading"><strong>5. PHYSICAL RESTRICTION: THE HIDDEN SOMATIC MECHANISM</strong></h2>',
         '<h2 class="wp-block-heading">5. Physical Restriction: The Hidden Somatic Mechanism</h2>'),
        ('<h2 class="wp-block-heading"><strong>6. RECOGNITION FRAMEWORKS</strong></h2>',
         '<h2 class="wp-block-heading">6. Recognition Frameworks</h2>'),
        ('<h2 class="wp-block-heading"><strong>7. CLINICAL AND SOCIAL IMPLICATIONS</strong></h2>',
         '<h2 class="wp-block-heading">7. Clinical and Social Implications</h2>'),
        ('<h2 class="wp-block-heading"><strong>8. DISCUSSION AND FUTURE RESEARCH</strong></h2>',
         '<h2 class="wp-block-heading">8. Discussion and Future Research</h2>'),
        ('<h2 class="wp-block-heading"><strong>9. CONCLUSION</strong></h2>',
         '<h2 class="wp-block-heading">9. Conclusion</h2>'),
        ('<h2 class="wp-block-heading"><strong>REFERENCES</strong></h2>',
         '<h2 class="wp-block-heading">References</h2>'),
    ],
    'the-princess-and-the-pea-when-physical-restriction-mimics-psychological-disorders': [
        ('<h2 class="wp-block-heading"><strong>ABSTRACT</strong></h2>',
         '<h2 class="wp-block-heading">Abstract</h2>'),
        ('<h2 class="wp-block-heading"><strong>1. THE MECHANISM: FROM VIOLENCE TO CALCIFICATION</strong></h2>',
         '<h2 class="wp-block-heading">1. The Mechanism: From Violence to Calcification</h2>'),
        ('<h2 class="wp-block-heading"><strong>2. THE PRINCESS AND THE PEA: HYPERSENSITIVITY AS DETECTION</strong></h2>',
         '<h2 class="wp-block-heading">2. The Princess and the Pea: Hypersensitivity as Detection</h2>'),
        ('<h2 class="wp-block-heading"><strong>3. MISDIAGNOSIS PATTERNS</strong></h2>',
         '<h2 class="wp-block-heading">3. Misdiagnosis Patterns</h2>'),
        ('<h2 class="wp-block-heading"><strong>4. RECOGNITION: FINDING YOUR PEA</strong></h2>',
         '<h2 class="wp-block-heading">4. Recognition: Finding Your Pea</h2>'),
        ('<h2 class="wp-block-heading"><strong>5. TREATMENT: REMOVING THE PEA</strong></h2>',
         '<h2 class="wp-block-heading">5. Treatment: Removing the Pea</h2>'),
        ('<h2 class="wp-block-heading"><strong>6. CLINICAL IMPLICATIONS</strong></h2>',
         '<h2 class="wp-block-heading">6. Clinical Implications</h2>'),
        ('<h2 class="wp-block-heading"><strong>7. THE BROADER CONTEXT</strong></h2>',
         '<h2 class="wp-block-heading">7. The Broader Context</h2>'),
        ('<h2 class="wp-block-heading"><strong>8. CONCLUSION</strong></h2>',
         '<h2 class="wp-block-heading">8. Conclusion</h2>'),
        ('<h2 class="wp-block-heading"><strong>REFERENCES</strong></h2>',
         '<h2 class="wp-block-heading">References</h2>'),
    ],
    'how-intra-community-trauma-shapes-the-architecture-of-belonging': [
        ('<h2 class="wp-block-heading">ABSTRACT</h2>',
         '<h2 class="wp-block-heading">Abstract</h2>'),
        ('<h2 class="wp-block-heading">1. THE NEUROBIOLOGICAL CONFLICT: THE COMPROMISED NETWORK</h2>',
         '<h2 class="wp-block-heading">1. The Neurobiological Conflict: The Compromised Network</h2>'),
        ('<h2 class="wp-block-heading">2. THE THREE ADAPTIVE TRAJECTORIES</h2>',
         '<h2 class="wp-block-heading">2. The Three Adaptive Trajectories</h2>'),
        ('<h2 class="wp-block-heading">3. THE FORK IN THE ROAD: INTROSPECTION AS THE CATALYST</h2>',
         '<h2 class="wp-block-heading">3. The Fork in the Road: Introspection as the Catalyst</h2>'),
        ('<h2 class="wp-block-heading">CONCLUSION</h2>',
         '<h2 class="wp-block-heading">Conclusion</h2>'),
    ],
}

# Editorial artifact blocks to remove from embodied-terror
EMBODIED_ARTIFACTS = [
    '\n\n\n\n<p class="wp-block-paragraph">💙💀📄</p>\n\n\n\n',
    '\n\n<p class="wp-block-paragraph">💙💀📄</p>\n\n',
    '\n\n\n\n<p class="wp-block-paragraph"><strong>50% shorter, tight, concise, informative.</strong></p>\n\n\n\n',
    '\n\n<p class="wp-block-paragraph"><strong>50% shorter, tight, concise, informative.</strong></p>\n\n',
    '\n\n\n\n<p class="wp-block-paragraph">🎯✨</p>\n\n\n\n',
    '\n\n<p class="wp-block-paragraph">🎯✨</p>\n\n',
]


def fix_page(slug, replacements):
    path = os.path.join(BASE, slug, 'index.html')
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    changed = 0
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new)
            changed += 1
        else:
            print(f'  NOT FOUND: {old[:60]}...')

    # Remove editorial artifacts for embodied-terror
    if 'embodied-terror' in slug:
        for artifact in EMBODIED_ARTIFACTS:
            if artifact in content:
                content = content.replace(artifact, '\n\n')
                changed += 1
        # Also catch the hr separator before the artifacts
        # The block is: <hr.../>\n\n\n\n<p>emoji</p>...<p>🎯✨</p>\n\n\n\n<p></p>
        # Use regex to catch any variant
        content = re.sub(
            r'<p class="wp-block-paragraph">💙💀📄</p>\s*',
            '',
            content
        )
        content = re.sub(
            r'<p class="wp-block-paragraph"><strong>50% shorter, tight, concise, informative\.</strong></p>\s*',
            '',
            content
        )
        content = re.sub(
            r'<p class="wp-block-paragraph">🎯✨</p>\s*',
            '',
            content
        )

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f'{slug}: {changed} replacements')


for slug, replacements in PAGES.items():
    fix_page(slug, replacements)

print('Done.')
