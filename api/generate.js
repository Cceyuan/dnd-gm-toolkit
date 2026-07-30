const SYSTEM_PROMPT = `You are a creative D&D 5e Game Master assistant. Generate rich, detailed, and atmospheric content for tabletop RPG games. Follow these rules:

1. Be specific and sensory — include sights, sounds, smells
2. Add unique twists — avoid generic fantasy clichés
3. Include mechanical hooks where relevant (skill checks, potential encounters)
4. Format output in clean Markdown with clear sections
5. Keep responses concise but vivid — aim for 200-400 words unless asked for more
6. Always include at least one unexpected element that sparks storytelling`;

const PROMPTS = {
  npc: (params) => `Create a memorable D&D 5e NPC with these traits:
- Race: ${params.race || 'Any (pick something interesting)'}
- Class/Profession: ${params.class || 'Any (pick something fitting)'}
- Role: ${params.role || 'Quest-giver or notable townsperson'}
- Personality tone: ${params.tone || 'Any (pick something distinctive)'}

Return a complete NPC profile with:
**Name & Title** — A memorable fantasy name with epithet
**First Impression** — What the party notices immediately (appearance, demeanor, one striking detail)
**Personality** — 2-3 traits with quirks
**Voice & Mannerisms** — How they speak and move
**What They Want** — Their secret motivation or goal
**Quest Hook** — A specific adventure seed this NPC can offer
**Stat Block Hint** — A brief mechanical note (e.g., "Uses Veteran stats with +2 CHA")`,

  tavern: (params) => `Create a unique fantasy tavern for a D&D campaign:
- Name style: ${params.style || 'Any (fantasy, humorous, ominous, cozy)'}
- Location type: ${params.location || 'Any (city slums, forest clearing, dwarven mine, coastal port, etc.)'}

Return a complete tavern description with:
**Tavern Name** — A creative, memorable name
**The Sign** — What hangs above the door and what it looks like
**First Impression** — What hits the party when they walk in (sights, sounds, smells)
**The Owner** — A brief NPC description of the tavern keeper
**Notable Patrons** — 2-3 interesting NPCs currently present
**Rumors** — 2-3 rumors the party might overhear (at least one is true, one is misleading)
**Secret** — Something hidden about this tavern (a back room, a cellar entrance, a patron's true identity)
**Menu Highlight** — One memorable food or drink item with description`,

  encounter: (params) => `Create a balanced D&D 5e combat encounter:
- Party level: ${params.level || '3'}
- Party size: ${params.size || '4'}
- Environment: ${params.environment || 'Any interesting fantasy location'}
- Difficulty: ${params.difficulty || 'Medium'}

Return a complete encounter with:
**Encounter Name** — A dramatic title
**The Setup** — Where the party is and how the encounter begins
**Environment Features** — 2-3 terrain elements that affect tactics (cover, hazards, elevation, interactive objects)
**Creatures** — Specific monster types and quantities (use official 5e monsters with CR appropriate for the party)
**Tactics** — How the creatures fight (ambush? frontal assault? hit-and-run?)
**Treasure** — What the party finds after victory
**Complication** — An unexpected twist that can occur during the fight`
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, params, apiKey } = req.body;

  if (!type || !PROMPTS[type]) {
    return res.status(400).json({ error: 'Invalid generator type. Use: npc, tavern, encounter' });
  }

  if (!apiKey || !apiKey.startsWith('sk-')) {
    return res.status(400).json({
      error: 'missing_key',
      message: 'Please enter your DeepSeek API key in Settings. Get one free at platform.deepseek.com'
    });
  }

  try {
    const prompt = PROMPTS[type](params || {});

    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1024,
        temperature: 0.9
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      if (resp.status === 401 || resp.status === 403) {
        return res.status(401).json({
          error: 'invalid_key',
          message: 'API key is invalid. Please check your key in Settings.'
        });
      }
      throw new Error(err.error?.message || `API returned ${resp.status}`);
    }

    const data = await resp.json();
    const generated = data.choices?.[0]?.message?.content;

    if (!generated) {
      throw new Error('Empty response from API');
    }

    return res.status(200).json({ generated });

  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      error: 'generation_failed',
      message: 'The elder gods are not responding. Please try again in a moment.'
    });
  }
};
