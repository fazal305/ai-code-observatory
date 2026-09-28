import { useState } from "react";
import { getExamplesByCategory } from "../../data/examples.js";
import styles from "./ExampleSelector.module.css";

const GROUPS = getExamplesByCategory();

function ExampleSelector({ activeExampleId, onSelect }) {
  const [openCategory, setOpenCategory] = useState(
    GROUPS.find((group) =>
      group.examples.some((example) => example.id === activeExampleId),
    )?.category ?? GROUPS[0]?.category,
  );

  return (
    <nav className={styles.list} aria-label="Example programs">
      {GROUPS.map(({ category, examples }) => {
        const isOpen = openCategory === category;
        return (
          <div key={category} className={styles.group}>
            <button
              type="button"
              className={styles.groupHeader}
              aria-expanded={isOpen}
              onClick={() => setOpenCategory(isOpen ? null : category)}
            >
              <span className={styles.caret} aria-hidden="true">
                {isOpen ? "▾" : "▸"}
              </span>
              {category}
            </button>
            {isOpen ? (
              <ul className={styles.examples}>
                {examples.map((example) => (
                  <li key={example.id}>
                    <button
                      type="button"
                      className={[
                        styles.exampleButton,
                        example.id === activeExampleId ? styles.active : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => onSelect(example)}
                      title={example.description}
                    >
                      {example.title}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

export default ExampleSelector;
