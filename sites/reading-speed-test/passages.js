/* =============================================================================
   passages.js - data only. Six original non-fiction passages written for this
   site (no copyrighted text). Contract: /specs/reading-speed-test.md.

   Each passage: { id, title, text, questions[5] }
     id        short, url-safe, STABLE (used in share links: ?p=<id>)
     text      plain text, 230-290 words, ASCII punctuation, paragraphs "\n\n"
     questions exactly 5, each { q, options[4], answer: 0-3 }
               answers are recall of facts stated in the text, not inference.
   The engine computes the word count at runtime (text.trim().split(/\s+/)).
   Exposed as window.PASSAGES in the browser and module.exports under Node.
   ============================================================================= */
(function (root) {
  'use strict';

  var PASSAGES = [
    {
      id: "lighthouses",
      title: "Why lighthouses blink",
      text:
        "Stand on a dark coast at night and you might see a lighthouse flashing in the distance. Look closely and you will notice that it does not simply blink on and off at random. Each lighthouse has its own rhythm, called its characteristic. One might flash once every five seconds. Another might give two quick flashes, then a long pause. A third might show a steady white light broken by a brief dark gap.\n\n" +
        "This is not decoration. The pattern is a signature. Sailors carry charts and light lists that describe every lighthouse on a stretch of coast, including its exact flash pattern. By timing the flashes with a watch, a navigator can tell which lighthouse they are looking at, and therefore roughly where their ship is. Two lighthouses close together with the same pattern would be dangerous, so neighboring lights are always given different rhythms.\n\n" +
        "Color adds a second layer of information. Most lighthouses show white light, but some add red or green sectors. If a ship sees the light turn red, it has drifted into a zone where rocks or shallow water lie, and it should steer back toward the white sector.\n\n" +
        "The flashing itself was originally produced by rotating the lens around a fixed lamp. A set of curved glass panels, invented in France in the 1820s by Augustin Fresnel, gathered the light into narrow beams. As the lens turned, each beam swept past the observer and appeared as a flash. Today most lighthouses are automated and many use electric lamps, but the idea has not changed. A pattern of light, repeated reliably all night, still tells a sailor exactly which piece of coast is ahead.",
      questions: [
        {
          q: "What is a lighthouse's particular flash rhythm called?",
          options: ["Its signal", "Its characteristic", "Its sector", "Its sweep"],
          answer: 1
        },
        {
          q: "How can a navigator work out which lighthouse they are looking at?",
          options: ["By measuring how bright the light is", "By counting the windows in the tower", "By timing the flashes with a watch", "By radioing the lighthouse keeper"],
          answer: 2
        },
        {
          q: "What does a red sector of light warn a ship about?",
          options: ["A harbor entrance ahead", "Strong currents", "Another ship nearby", "Rocks or shallow water"],
          answer: 3
        },
        {
          q: "Who invented the curved glass lens panels, and where?",
          options: ["Augustin Fresnel, in France", "Isaac Newton, in England", "Thomas Edison, in the United States", "Galileo Galilei, in Italy"],
          answer: 0
        },
        {
          q: "How was the flashing originally produced?",
          options: ["By switching the lamp on and off", "By rotating the lens around a fixed lamp", "By opening and closing wooden shutters", "By a keeper waving a lantern"],
          answer: 1
        }
      ]
    },
    {
      id: "honey",
      title: "Why honey almost never spoils",
      text:
        "Archaeologists exploring ancient Egyptian tombs have found sealed pots of honey that were thousands of years old. Remarkably, the honey inside was still edible. Honey resists spoiling for a combination of reasons, and no single one of them would be enough on its own.\n\n" +
        "The first reason is sugar. Honey is about 80 percent sugar and only about 17 percent water. Bacteria and molds need water to grow, and in honey the sugar holds the little water that exists so tightly that microbes cannot use it. Scientists describe this as low water activity. A microbe landing on honey effectively dries out.\n\n" +
        "The second reason is acidity. Honey has a pH between about 3.5 and 4.5, roughly similar to orange juice. Most of the bacteria that cause food to spoil prefer neutral conditions and struggle in acid.\n\n" +
        "The third reason comes from the bees themselves. When a bee collects nectar, it adds an enzyme called glucose oxidase. As the honey matures, this enzyme produces small amounts of hydrogen peroxide, the same chemical used in some antiseptics. The amount is tiny, but it adds one more barrier.\n\n" +
        "Finally, bees are good at drying. Nectar is mostly water when it enters the hive. Worker bees fan it with their wings until enough moisture has evaporated, then seal the cell with a wax cap that keeps new moisture out.\n\n" +
        "Honey does have one weakness. If it is left open in a humid room, it absorbs water from the air. Once the water content rises, yeasts can begin to ferment it. Keep the lid on, and a jar of honey can outlast the person who bought it.",
      questions: [
        {
          q: "Roughly what percentage of honey is water?",
          options: ["About 50 percent", "About 35 percent", "About 17 percent", "About 5 percent"],
          answer: 2
        },
        {
          q: "What enzyme do bees add to nectar?",
          options: ["Glucose oxidase", "Amylase", "Lactase", "Catalase"],
          answer: 0
        },
        {
          q: "The acidity of honey is compared to which drink?",
          options: ["Milk", "Orange juice", "Coffee", "Black tea"],
          answer: 1
        },
        {
          q: "How do worker bees remove moisture from nectar?",
          options: ["By warming the hive with their bodies", "By mixing it with wax", "By adding pollen to it", "By fanning it with their wings"],
          answer: 3
        },
        {
          q: "What is the one weakness of honey mentioned in the passage?",
          options: ["It attracts ants", "It hardens in the cold", "It absorbs water from humid air", "It loses sweetness over time"],
          answer: 2
        }
      ]
    },
    {
      id: "blue-sky",
      title: "Why the sky is blue",
      text:
        "Sunlight looks white, but it is actually a mixture of all the colors of the rainbow. When that light reaches Earth, it has to travel through the atmosphere, a thick blanket of gas made mostly of nitrogen and oxygen molecules. Those molecules are far smaller than the wavelength of visible light, and that size difference is the key to the whole story.\n\n" +
        "When light passes near a very small particle, some of it gets scattered, meaning it is bounced off in a new direction. Not every color scatters equally. Shorter wavelengths scatter much more strongly than longer ones. Blue light has a short wavelength, so it is scattered roughly five times more than red light, which has a long wavelength. This effect is named Rayleigh scattering, after the British physicist Lord Rayleigh, who worked out the mathematics in the 1870s.\n\n" +
        "The result is that blue light is sprayed across the whole sky in every direction. Look anywhere other than directly at the sun and the light reaching your eye is mostly this scattered blue. Violet light scatters even more than blue, but the sun gives off less violet, some of it is absorbed high in the atmosphere, and human eyes are less sensitive to it. So the sky looks blue rather than purple.\n\n" +
        "Sunsets flip the effect. When the sun is low, its light travels through far more air to reach you. Most of the blue has been scattered away sideways by the time the light arrives, leaving the reds and oranges that pass straight through. Dust and smoke can deepen those colors further.\n\n" +
        "On the Moon, which has no atmosphere, there is nothing to scatter the light. The sky there is black even at midday.",
      questions: [
        {
          q: "According to the passage, which two gases make up most of the atmosphere?",
          options: ["Hydrogen and helium", "Nitrogen and oxygen", "Carbon dioxide and argon", "Oxygen and water vapor"],
          answer: 1
        },
        {
          q: "Roughly how much more strongly is blue light scattered than red light?",
          options: ["About five times as much", "About twice as much", "About fifty times as much", "About the same amount"],
          answer: 0
        },
        {
          q: "Which physicist gave his name to the scattering effect?",
          options: ["Isaac Newton", "James Clerk Maxwell", "Lord Rayleigh", "Albert Einstein"],
          answer: 2
        },
        {
          q: "Why does the sky not look violet, even though violet scatters more than blue?",
          options: ["Violet light cannot pass through nitrogen", "Clouds reflect violet light back into space", "Violet light only appears at sunset", "The sun gives off less violet and human eyes are less sensitive to it"],
          answer: 3
        },
        {
          q: "What color is the midday sky on the Moon?",
          options: ["Black", "Deep blue", "Gray", "White"],
          answer: 0
        }
      ]
    },
    {
      id: "pigeons",
      title: "How carrier pigeons found their way home",
      text:
        "Long before radio, people sent urgent messages by pigeon. A bird released far from home would fly straight back to its loft with a tiny note strapped to its leg. Pigeons carried news of Olympic results in ancient Greece, stock prices in nineteenth-century Europe, and military messages in both world wars. One famous bird, Cher Ami, delivered a message in 1918 that helped save nearly 200 trapped American soldiers.\n\n" +
        "The system had one strict limit. A pigeon only flies home. So messengers carried baskets of birds outward and released them to carry replies back. For two-way contact, each side needed pigeons raised in the other side's loft.\n\n" +
        "How the birds find home has been studied for more than a century, and pigeons seem to use several tools at once. On sunny days they use the sun as a compass, correcting for the time of day with an internal clock. Experiments that shifted a pigeon's clock by several hours caused it to set off in the wrong direction by a predictable angle. Pigeons can also sense the Earth's magnetic field, which gives them a backup compass under cloud.\n\n" +
        "A compass alone is not enough, though. The bird also needs to know where it is relative to home. Evidence suggests that pigeons build a mental map of familiar landmarks such as roads, rivers and coastlines, and that smell plays a part too. Birds whose sense of smell was blocked in experiments homed far less reliably from unfamiliar places.\n\n" +
        "Pigeon post faded once the telegraph arrived, but hobbyists still race the birds today, and the fastest can average more than 90 kilometers per hour.",
      questions: [
        {
          q: "What was the name of the pigeon that helped save trapped soldiers in 1918?",
          options: ["Cher Ami", "Winkie", "Paddy", "Mercury"],
          answer: 0
        },
        {
          q: "What was the one strict limit of sending messages by pigeon?",
          options: ["Pigeons only fly in daylight", "A pigeon only flies home", "Pigeons cannot cross open water", "Pigeons refuse to fly in rain"],
          answer: 1
        },
        {
          q: "What happened when experimenters shifted a pigeon's internal clock?",
          options: ["It refused to fly at all", "It flew home faster than usual", "It circled until nightfall", "It set off in the wrong direction by a predictable angle"],
          answer: 3
        },
        {
          q: "Blocking which sense made pigeons home less reliably from unfamiliar places?",
          options: ["Hearing", "Smell", "Touch", "Taste"],
          answer: 1
        },
        {
          q: "Which invention caused pigeon post to fade?",
          options: ["The telephone", "The railway", "The telegraph", "The airplane"],
          answer: 2
        }
      ]
    },
    {
      id: "coins",
      title: "How vending machines tell coins apart",
      text:
        "Drop a coin into a vending machine and, within a fraction of a second, the machine has decided whether it is real, which denomination it is, and whether to accept it. Older machines did this with purely mechanical tricks. Modern ones use a small device called a coin validator, and it checks several properties at once.\n\n" +
        "The simplest check is size. The coin slides down a channel past gaps and ramps shaped so that coins of the wrong diameter or thickness drop into the reject chute. Weight matters too, and some machines use a small balance arm that only tips for coins in the right range.\n\n" +
        "The clever part is the metal test. As the coin rolls past, it travels through a magnetic field generated by a coil. The metal in the coin disturbs the field, and the strength and shape of that disturbance depend on what the coin is made of. A copper-nickel coin leaves a different signature from a steel one, which is why a washer of the right size still fails. Sensors read the disturbance and compare it with stored values for every accepted coin.\n\n" +
        "Many validators also measure how fast the coin rolls through a light beam, which combines information about its mass and diameter. A coin that passes all the tests is routed by a small gate into the correct storage tube. A coin that fails any test is sent back to the customer.\n\n" +
        "This is also why machines sometimes reject genuine coins. A badly worn, bent or dirty coin can fall just outside the accepted range. Shaking the machine does not help. The checks are electronic, and the coin has already been judged by the time it lands in the return slot.",
      questions: [
        {
          q: "What is the device that checks coins in a modern vending machine called?",
          options: ["A coin counter", "A coin validator", "A coin sorter", "A coin scanner"],
          answer: 1
        },
        {
          q: "What does the magnetic field test reveal about a coin?",
          options: ["Its weight", "Its age", "What metal it is made of", "Which country issued it"],
          answer: 2
        },
        {
          q: "Why does a washer of the right size still fail?",
          options: ["It is too light to tip the balance arm", "It rolls too slowly through the light beam", "It is not perfectly round", "Its metal leaves a different signature in the magnetic field"],
          answer: 3
        },
        {
          q: "Where does a coin that passes every test go?",
          options: ["Into the correct storage tube", "Into a melting chamber", "Back to the customer", "Into a shared hopper for all coins"],
          answer: 0
        },
        {
          q: "Why does shaking the machine not help with a rejected coin?",
          options: ["The machine locks itself when shaken", "The coin has already been judged electronically", "The coin is destroyed on rejection", "The machine calls an attendant"],
          answer: 1
        }
      ]
    },
    {
      id: "bread",
      title: "Why bread rises",
      text:
        "A lump of bread dough weighs the same after it rises as before, yet it can double in size. The extra volume is gas, and the gas comes from a living ingredient: yeast.\n\n" +
        "Yeast is a single-celled fungus. The kind used in baking, Saccharomyces cerevisiae, feeds on sugars. Flour contains starch, and when flour is mixed with water, enzymes in the flour begin to break some of that starch down into simple sugars the yeast can eat. As the yeast digests sugar, it releases carbon dioxide gas and a little alcohol. This process is called fermentation, and it is the same one that makes beer and wine.\n\n" +
        "The gas alone would simply escape if the dough could not hold it. That is where gluten comes in. Wheat flour contains two proteins, glutenin and gliadin. When they get wet and are worked together by kneading, they link into a stretchy, elastic network. This network traps the carbon dioxide in thousands of tiny bubbles. Kneading is important because it develops that network. Under-kneaded dough is weak and lets gas leak away.\n\n" +
        "Temperature controls the pace. Yeast works slowly in a cold kitchen and quickly in a warm one. Above about 60 degrees Celsius, however, the yeast dies.\n\n" +
        "In the oven, three things happen in quick succession. The trapped gas expands with the heat, the alcohol boils off, and the bubbles swell in a final burst that bakers call oven spring. Then the gluten sets and the starch firms up, locking the airy structure in place. Cut the loaf open and every hole you see is a bubble of gas that yeast made and gluten caught.",
      questions: [
        {
          q: "What kind of organism is yeast?",
          options: ["A bacterium", "A single-celled fungus", "A type of algae", "A plant seed"],
          answer: 1
        },
        {
          q: "Which two proteins in wheat flour form gluten?",
          options: ["Casein and whey", "Albumin and keratin", "Glutenin and gliadin", "Collagen and elastin"],
          answer: 2
        },
        {
          q: "Why is kneading important?",
          options: ["It develops the gluten network", "It adds sugar for the yeast", "It removes excess alcohol", "It kills unwanted bacteria"],
          answer: 0
        },
        {
          q: "Above roughly what temperature does the yeast die?",
          options: ["30 degrees Celsius", "45 degrees Celsius", "60 degrees Celsius", "100 degrees Celsius"],
          answer: 2
        },
        {
          q: "What do bakers call the final burst of swelling in the oven?",
          options: ["Proofing", "Crumb set", "Blooming", "Oven spring"],
          answer: 3
        }
      ]
    }
  ];

  root.PASSAGES = PASSAGES;
  if (typeof module !== 'undefined' && module.exports) { module.exports = PASSAGES; }
})(typeof window !== 'undefined' ? window : this);
