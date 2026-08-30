import React from 'react'
import Navigation from '/src/stories/components/Navigation';



function MobileNavigation({ componentHandler, setCurrentComponent }) {


  return (
    <Navigation componentHandler={componentHandler} setCurrentComponent={setCurrentComponent} />
  );
}

MobileNavigation.propTypes = {
  // startElement: PropTypes.element,
  // endElement: PropTypes.element,
  // customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  // onClick: PropTypes.func,
  // currentComponent: PropTypes.oneOf(['primary', 'secondary'])
}

MobileNavigation.defaultProps = {
  // startElement: null,
  // endElement: null,
  // customStyles: null,
  // onClick: null,
  // currentComponent: 'primary'

}

export default MobileNavigation
