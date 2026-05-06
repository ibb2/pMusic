import { useState } from 'react'

function Versions(): React.JSX.Element {
  const [versions] = useState({
    runtime: 'Bun',
    desktop: 'Electrobun'
  })

  return (
    <ul className="versions">
      <li>{versions.desktop}</li>
      <li>{versions.runtime}</li>
    </ul>
  )
}

export default Versions
